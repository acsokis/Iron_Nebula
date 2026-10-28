using System;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace IronNebula;

/// <summary>Resolution, actual render-target MSAA, and a half-second postprocessed hit effect.</summary>
public sealed partial class IronNebulaGame
{
    // Exact 16:9 and 16:10 choices; internal gameplay always remains 1920x1080.
    private static readonly (int Width,int Height,string Name)[] ResolutionOptions =
    {
        (1280,720,"1280 x 720  (16:9 / 720p)"),
        (1600,900,"1600 x 900  (16:9)"),
        (1920,1080,"1920 x 1080  (16:9 / 1080p)"),
        (2560,1440,"2560 x 1440  (16:9 / 1440p)"),
        (3200,1800,"3200 x 1800  (16:9 / 1800p)"),
        (3840,2160,"3840 x 2160  (16:9 / 4K UHD)"),
        (1280,800,"1280 x 800  (16:10)"),
        (1440,900,"1440 x 900  (16:10)"),
        (1680,1050,"1680 x 1050  (16:10)"),
        (1920,1200,"1920 x 1200  (16:10)"),
        (2560,1600,"2560 x 1600  (16:10)"),
        (3840,2400,"3840 x 2400  (16:10 / 4K class)")
    };
    private static readonly int[] MsaaOptions={0,2,4,8};
    private int _resolutionIndex=1;
    private int _enemyShotGlow=50;
    private int _hitEffectStrength=55;
    private int _msaaRequest, _effectiveMsaa;
    private float _hitFeedbackTime;
    private const float HitEffectDuration=.5f;

    private string ResolutionLabel() => ResolutionOptions[_resolutionIndex].Name;

    private void ApplyDisplayConfiguration()
    {
        var mode=ResolutionOptions[_resolutionIndex];
        DisplayMode display=GraphicsAdapter.DefaultAdapter.CurrentDisplayMode;
        int usableW=Math.Max(640,display.Width-48);
        int usableH=Math.Max(360,display.Height-112);
        // Keep the selected logical resolution. Only the window/backbuffer is
        // fitted to the monitor; the saved setting and virtual gameplay stay intact.
        float scale=_fullscreen
            ? Math.Min(1f,Math.Min(display.Width/(float)mode.Width,display.Height/(float)mode.Height))
            : Math.Min(1f,Math.Min(usableW/(float)mode.Width,usableH/(float)mode.Height));
        int actualW=Math.Max(1,(int)MathF.Floor(mode.Width*scale));
        int actualH=Math.Max(1,(int)MathF.Floor(mode.Height*scale));
        _graphics.IsFullScreen=_fullscreen;
        _graphics.PreferredBackBufferWidth=actualW;
        _graphics.PreferredBackBufferHeight=actualH;
        _graphics.SynchronizeWithVerticalRetrace=_vsyncEnabled;
        // MSAA is configured on the virtual scene target. Avoid asking the
        // window/backbuffer to renegotiate its display mode on AA changes.
        _graphics.PreferMultiSampling=false;
        try
        {
            _graphics.ApplyChanges();
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            // Unsupported fullscreen mode: recover in a monitor-fitted window
            // without changing the logical resolution selected by the user.
            _fullscreen=false;
            _graphics.IsFullScreen=false;
            _graphics.PreferredBackBufferWidth=Math.Min(actualW,usableW);
            _graphics.PreferredBackBufferHeight=Math.Min(actualH,usableH);
            _graphics.ApplyChanges();
        }
        if(_scene!=null) RebuildDisplayTargets();
    }

    private void RebuildDisplayTargets()
    {
        // MSAA is applied to the actual scene render target, NOT just the backbuffer.
        // Unsupported requests gracefully fall back to smaller sample counts.
        int requested=MsaaOptions[_msaaRequest];
        int[] candidateCounts=requested switch
        {
            8=>new[]{8,4,2,0},
            4=>new[]{4,2,0},
            2=>new[]{2,0},
            _=>new[]{0}
        };
        RenderTarget2D? replacement=null;
        int selected=0;
        foreach(int samples in candidateCounts)
        {
            try
            {
                replacement=new RenderTarget2D(GraphicsDevice,ViewWidth,ViewHeight,false,
                    SurfaceFormat.Color,DepthFormat.None,samples,RenderTargetUsage.DiscardContents);
                selected=samples;
                break;
            }
            catch (Exception ex) when (ex is not OutOfMemoryException)
            {
                // Driver does not support the sample count or target format.
                // Try the next lower MSAA mode rather than crash on startup.
            }
        }
        if(replacement==null) return; // Keep the existing valid target.
        GraphicsDevice.SetRenderTarget(null);
        _scene.Dispose();
        _scene=replacement;
        _effectiveMsaa=selected;
        _hitBlurTarget?.Dispose();
        _hitBlurTarget=new RenderTarget2D(GraphicsDevice,384,216,false,
            SurfaceFormat.Color,DepthFormat.None);
    }

    private void PresentSceneWithHitFeedback()
    {
        float strength=_hitEffectStrength/100f;
        float fade=MathHelper.Clamp(_hitFeedbackTime/HitEffectDuration,0f,1f);
        float effect=_mode==GameMode.Playing ? fade*strength : 0f;
        if(effect>.001f && _hitBlurTarget!=null)
        {
            // Physically downsample the complete composed frame, including HUD,
            // then bilinearly upscale it: real full-screen blur, no halo sprite.
            GraphicsDevice.SetRenderTarget(_hitBlurTarget);
            GraphicsDevice.Clear(Color.Black);
            _batch.Begin(blendState:BlendState.Opaque,samplerState:SamplerState.LinearClamp);
            _batch.Draw(_scene,new Rectangle(0,0,_hitBlurTarget.Width,_hitBlurTarget.Height),Color.White);
            _batch.End();
        }
        GraphicsDevice.SetRenderTarget(null);
        GraphicsDevice.Clear(Color.Black);
        int w=GraphicsDevice.Viewport.Width,h=GraphicsDevice.Viewport.Height;
        float scale=Math.Min(w/(float)ViewWidth,h/(float)ViewHeight);
        int width=(int)(ViewWidth*scale),height=(int)(ViewHeight*scale);
        Rectangle destination=new((w-width)/2,(h-height)/2,width,height);
        if(effect>.001f)
        {
            float elapsed=HitEffectDuration-_hitFeedbackTime;
            destination.Offset((int)(MathF.Sin(elapsed*103f)*7f*effect*scale),
                (int)(MathF.Cos(elapsed*83f)*5f*effect*scale));
        }
        _batch.Begin(blendState:BlendState.Opaque,samplerState:SamplerState.LinearClamp);
        _batch.Draw(_scene,destination,Color.White);
        _batch.End();
        if(effect>.001f && _hitBlurTarget!=null)
        {
            _batch.Begin(blendState:BlendState.AlphaBlend,samplerState:SamplerState.LinearClamp);
            _batch.Draw(_hitBlurTarget,destination,Color.White*effect);
            _batch.End();
        }
    }
}