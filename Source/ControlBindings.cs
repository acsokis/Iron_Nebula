using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Microsoft.Xna.Framework.Input;

namespace IronNebula;

internal enum GameAction
{
    MoveUp, MoveDown, MoveLeft, MoveRight, Fire, Precision,
    WeaponNext, WeaponPrevious, Pause,
    Pulse, Lance, Arc, Gatling, Beam
}

internal sealed class ControlBindings
{
    private readonly Dictionary<GameAction, Keys> _keys = new();
    internal static readonly GameAction[] All = (GameAction[])Enum.GetValues(typeof(GameAction));
    internal ControlBindings() { RestoreDefaults(); }

    internal static string PathForBindings => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "IronNebula", "controls.json");

    internal void RestoreDefaults()
    {
        _keys.Clear();
        _keys[GameAction.MoveUp] = Keys.W;
        _keys[GameAction.MoveDown] = Keys.S;
        _keys[GameAction.MoveLeft] = Keys.A;
        _keys[GameAction.MoveRight] = Keys.D;
        _keys[GameAction.Fire] = Keys.Space;
        _keys[GameAction.Precision] = Keys.LeftShift;
        _keys[GameAction.WeaponNext] = Keys.Tab;
        _keys[GameAction.WeaponPrevious] = Keys.Q;
        _keys[GameAction.Pause] = Keys.P;
        _keys[GameAction.Pulse] = Keys.D1;
        _keys[GameAction.Lance] = Keys.D2;
        _keys[GameAction.Arc] = Keys.D3;
        _keys[GameAction.Gatling] = Keys.D4;
        _keys[GameAction.Beam] = Keys.D5;
    }

    internal Keys this[GameAction action] => _keys[action];

    internal bool TryBind(GameAction action, Keys key)
    {
        if (key == Keys.None || key is Keys.F1 or Keys.F2 or Keys.F3 or Keys.F4 or Keys.F5 or
            Keys.F6 or Keys.F7 or Keys.F8 or Keys.F9 or Keys.F10 or Keys.F11 or Keys.F12 or
            Keys.Escape or Keys.Enter or Keys.O ||
            key == Keys.Up || key == Keys.Down || key == Keys.Left || key == Keys.Right)
            return false; // reserve unambiguous menu navigation, help and debug shortcuts
        foreach (var binding in _keys)
            if (binding.Key != action && binding.Value == key) return false;
        _keys[action] = key;
        return true;
    }

    internal bool Down(KeyboardState keys, GameAction action)
    {
        if (keys.IsKeyDown(_keys[action])) return true;
        // Arrow keys remain the alternate ship movement controls.
        return action switch
        {
            GameAction.MoveUp => keys.IsKeyDown(Keys.Up),
            GameAction.MoveDown => keys.IsKeyDown(Keys.Down),
            GameAction.MoveLeft => keys.IsKeyDown(Keys.Left),
            GameAction.MoveRight => keys.IsKeyDown(Keys.Right),
            _ => false
        };
    }

    internal void Load()
    {
        try
        {
            if (!File.Exists(PathForBindings)) return;
            var value = JsonSerializer.Deserialize<Dictionary<string,string>>(File.ReadAllText(PathForBindings));
            if (value is null) return;
            foreach (GameAction a in All)
                if (value.TryGetValue(a.ToString(),out string? s) && Enum.TryParse(s,out Keys key))
                    TryBind(a,key);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        catch (JsonException) { }
    }

    internal void Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(PathForBindings)!);
            var value = new Dictionary<string,string>();
            foreach (GameAction a in All) value[a.ToString()] = _keys[a].ToString();
            File.WriteAllText(PathForBindings, JsonSerializer.Serialize(value,new JsonSerializerOptions{WriteIndented=true}));
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}