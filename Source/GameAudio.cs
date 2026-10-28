using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Microsoft.Xna.Framework.Audio;

namespace IronNebula;

/// <summary>
/// MonoGame-only audio: no NAudio package and no system MP3 codec needed at runtime.
/// The user-provided MP3 is preserved in Assets/Audio, alongside a pre-decoded
/// 16-bit PCM, 32 kHz stereo WAV used for low-memory streaming.
/// </summary>
internal sealed class GameAudio : IDisposable
{
    /// <summary>
    /// Reads PCM frames from the WAV data chunk and queues short buffers to MonoGame.
    /// Only a fraction of a second of music is buffered; EOF loops seamlessly.
    /// All calls are made on the MonoGame update/main thread.
    /// </summary>
    private sealed class StreamingMusic : IDisposable
    {
        private readonly FileStream _file;
        private readonly DynamicSoundEffectInstance _output;
        private readonly long _dataStart;
        private readonly long _dataEnd;
        private readonly int _blockAlign;
        private readonly int _bufferBytes;
        private bool _disposed;

        public StreamingMusic(string wavPath, int volume)
        {
            _file = File.OpenRead(wavPath);
            try
            {
                using var br = new BinaryReader(_file, Encoding.ASCII, leaveOpen: true);
                if (Encoding.ASCII.GetString(br.ReadBytes(4)) != "RIFF" ||
                    br.ReadUInt32() < 36 ||
                    Encoding.ASCII.GetString(br.ReadBytes(4)) != "WAVE")
                    throw new InvalidDataException("The background music must be a RIFF/WAVE file.");

                ushort format = 0, channels = 0, bits = 0, align = 0;
                int rate = 0;
                long audioStart = -1, audioLength = 0;
                while (_file.Position + 8 <= _file.Length)
                {
                    string id = Encoding.ASCII.GetString(br.ReadBytes(4));
                    uint chunkSize = br.ReadUInt32();
                    long chunkStart = _file.Position;
                    long next = chunkStart + chunkSize + (chunkSize & 1u);
                    if (next > _file.Length + 1) throw new InvalidDataException("Invalid WAV chunk size.");
                    if (id == "fmt " && chunkSize >= 16)
                    {
                        format = br.ReadUInt16();
                        channels = br.ReadUInt16();
                        rate = br.ReadInt32();
                        br.ReadUInt32();  // bytes per second
                        align = br.ReadUInt16();
                        bits = br.ReadUInt16();
                    }
                    else if (id == "data")
                    {
                        audioStart = chunkStart;
                        audioLength = chunkSize;
                    }
                    _file.Position = Math.Min(next, _file.Length);
                }
                if (format != 1 || (channels != 1 && channels != 2) || bits != 16 ||
                    rate < 8000 || rate > 48000 || align != channels * 2 || audioStart < 0 || audioLength < align)
                    throw new InvalidDataException("Music must be 16-bit PCM WAV, mono/stereo, 8-48 kHz.");

                _dataStart = audioStart;
                _dataEnd = audioStart + audioLength;
                _blockAlign = align;
                _file.Position = _dataStart;
                _bufferBytes = Math.Max(_blockAlign, (rate / 4 * align) / align * align); // 250 ms, aligned
                _output = new DynamicSoundEffectInstance(rate, channels == 2 ? AudioChannels.Stereo : AudioChannels.Mono);
                _output.Volume = Math.Clamp(volume / 100f, 0f, 1f);
                QueueBuffers();
                _output.Play();
            }
            catch
            {
                _file.Dispose();
                throw;
            }
        }

        private void QueueBuffers()
        {
            while (!_disposed && _output.PendingBufferCount < 4)
            {
                var buffer = new byte[_bufferBytes];
                int written = 0;
                while (written < buffer.Length)
                {
                    if (_file.Position >= _dataEnd) _file.Position = _dataStart;
                    int toRead = (int)Math.Min(buffer.Length - written, _dataEnd - _file.Position);
                    toRead -= toRead % _blockAlign;
                    if (toRead <= 0)
                    {
                        _file.Position = _dataStart;
                        continue;
                    }
                    int received = _file.Read(buffer, written, toRead);
                    if (received <= 0) throw new EndOfStreamException("Cannot read music audio frames.");
                    written += received;
                }
                _output.SubmitBuffer(buffer);
            }
        }

        public void Update()
        {
            if (_disposed) return;
            QueueBuffers();
            if (_output.State == SoundState.Stopped) _output.Play();
        }
        public void SetVolume(int volume)
        {
            if (!_disposed) _output.Volume = Math.Clamp(volume / 100f, 0f, 1f);
        }
        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            try { _output.Stop(); } catch { }
            _output.Dispose();
            _file.Dispose();
        }
    }

    private readonly Dictionary<string, SoundEffect> _effects = new();
    private readonly Dictionary<string, double> _lastPlay = new();
    private StreamingMusic? _music;
    private SoundEffectInstance? _beamInstance;
    private float _musicMood=0.72f;
    private float _musicTarget=0.72f;
    private float _transitionDuckTimer;
    private double _fxWindowStart;
    private int _fxWindowCount;
    private double _clock;
    private readonly string _settingsPath;
    public int MusicVolume { get; private set; } = 55;
    public int SfxVolume { get; private set; } = 75;

    public GameAudio(string assetsFolder)
    {
        _settingsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "IronNebula", "audio_settings.txt");
        try
        {
            if (File.Exists(_settingsPath))
            {
                string[] parts = File.ReadAllText(_settingsPath).Split(',');
                if (parts.Length >= 2 && int.TryParse(parts[0], out int music) && int.TryParse(parts[1], out int sfx))
                {
                    MusicVolume = Math.Clamp(music, 0, 100);
                    SfxVolume = Math.Clamp(sfx, 0, 100);
                }
            }
        }
        catch { /* A missing/unwritable profile must not block game startup. */ }

        foreach (string name in new[] { "pulse", "lance", "arc", "gatling", "beam", "hit", "explosion",
                 "shield", "pickup", "shop", "damage", "boss", "boss_phase", "boss_module",
                 "boss_warning", "boss_finale", "sector_transition" })
        {
            try
            {
                using var file = File.OpenRead(Path.Combine(assetsFolder, "Audio", name + ".wav"));
                _effects[name] = SoundEffect.FromStream(file);
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"SFX {name}: {ex.Message}"); }
        }

        try
        {
            if (_effects.TryGetValue("beam", out var beam))
            {
                _beamInstance = beam.CreateInstance();
                _beamInstance.IsLooped = true;
            }
        }
        catch (Exception ex) { System.Diagnostics.Debug.WriteLine("Beam audio unavailable: " + ex.Message); }

        try
        {
            _music = new StreamingMusic(Path.Combine(assetsFolder, "Audio", "Propulsive Peak_stream.wav"), MusicVolume);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine("Music unavailable: " + ex.Message);
            _music = null;
        }
    }

    public void SetMusicMood(bool playing,bool boss,bool shop)
    {
        // Duck the original user-provided music rather than switching tracks.
        // The base 0..100 user volume setting is kept unchanged.
        _musicTarget = boss ? 1f : playing ? .85f : shop ? .52f : .60f;
    }

    public void StartTransitionDuck() => _transitionDuckTimer=2.1f;

    public void Tick(float dt)
    {
        _clock += dt;
        // Stable time-based crossfade; a short scene-change dip allows a new
        // sector's entry cue to stand out without restarting the user's track.
        _transitionDuckTimer=Math.Max(0f,_transitionDuckTimer-dt);
        float duck=_transitionDuckTimer>0f ? .48f+.52f*(1f-_transitionDuckTimer/2.1f) : 1f;
        float fraction=1f-MathF.Exp(-Math.Max(0f,dt)*1.8f);
        _musicMood+=(_musicTarget*duck-_musicMood)*fraction;
        try { _music?.SetVolume((int)MathF.Round(MusicVolume*_musicMood)); _music?.Update(); }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine("Music playback stopped: " + ex.Message);
            _music?.Dispose();
            _music = null;
        }
    }
    public void SetVolume(bool music, int value)
    {
        if (music)
        {
            MusicVolume = Math.Clamp(value, 0, 100);
            _music?.SetVolume((int)MathF.Round(MusicVolume*_musicMood));
        }
        else
        {
            SfxVolume = Math.Clamp(value, 0, 100);
            if (_beamInstance != null) _beamInstance.Volume = SfxVolume / 100f * .35f;
        }
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_settingsPath)!);
            File.WriteAllText(_settingsPath, $"{MusicVolume},{SfxVolume}");
        }
        catch { }
    }
    public void Effect(string name, float cooldown = .07f, float gain = 1f)
    {
        if (SfxVolume == 0 || !_effects.TryGetValue(name, out var sfx)) return;
        if (_lastPlay.TryGetValue(name, out double last) && _clock - last < cooldown) return;
        _lastPlay[name] = _clock;
        // Keep rapid Gatling and multi-hit collisions from creating dozens of
        // simultaneous SoundEffect voices. Boss alerts have their own priority.
        if(_clock-_fxWindowStart>=1.0) { _fxWindowStart=_clock; _fxWindowCount=0; }
        bool priority=name.StartsWith("boss_",StringComparison.Ordinal)||name=="sector_transition";
        if(!priority && _fxWindowCount>=24) return;
        if(!priority) _fxWindowCount++;
        try { sfx.Play(Math.Clamp(SfxVolume / 100f * gain, 0f, 1f), 0f, 0f); } catch { }
    }
    public void Beam(bool firing)
    {
        if (_beamInstance == null) return;
        try
        {
            if (firing && SfxVolume > 0)
            {
                _beamInstance.Volume = SfxVolume / 100f * .34f;
                if (_beamInstance.State != SoundState.Playing) _beamInstance.Play();
            }
            else if (_beamInstance.State == SoundState.Playing) _beamInstance.Stop();
        }
        catch { }
    }
    public void Dispose()
    {
        try { _beamInstance?.Stop(); } catch { }
        _beamInstance?.Dispose();
        _music?.Dispose();
        foreach (var s in _effects.Values) s.Dispose();
    }
}