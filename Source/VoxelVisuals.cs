using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace IronNebula;

// Visual topology only: gameplay damage and collision stay authoritative.
internal sealed class VoxelVisuals : IDisposable
{
    private sealed record Topology(Texture2D Texture,List<Rectangle> Cells);
    private sealed class Body
    {
        public Topology Topology=null!;
        public int Keep,Frame;
        public Vector2 Position,Origin;
        public float Rotation,Scale;
        public SpriteEffects Effects;
        public ShieldSpectrum? Spectrum;
        public float Flash;
    }
    private sealed record Shard(Texture2D Texture,Rectangle Source,Vector2 Position,Vector2 Velocity,float Rotation,float Spin,float Scale,float Born,float Life);
    private readonly Dictionary<Texture2D,Topology> _topologies=new();
    private readonly Dictionary<object,Body> _bodies=new();
    private readonly List<Shard> _shards=new();
    private Texture2D? _shield;
    private int _frame;
    private float _time,_dt;
    public int Fragments=>_shards.Count;
    public object Diagnostics=>new { fragments=_shards.Count,objects=_bodies.Select(p=>new { key=p.Key.ToString(),total=p.Value.Topology.Cells.Count,remaining=p.Value.Keep,shield=p.Value.Spectrum!=null }).ToArray() };
    private static uint Rank(int x,int y)
    {
        unchecked{uint h=(uint)(x+1)*374761393u^(uint)(y+3)*668265263u;h=(h^(h>>13))*1274126177u;return h^(h>>16);}
    }
    private Topology GetTopology(Texture2D texture)
    {
        if(_topologies.TryGetValue(texture,out var cached))return cached;
        var pixels=new Color[texture.Width*texture.Height];texture.GetData(pixels);
        const int columns=48;int rows=Math.Max(8,(int)MathF.Round(columns*texture.Height/(float)texture.Width));
        var cells=new List<(Rectangle Source,uint Order)>();
        for(int y=0;y<rows;y++)for(int x=0;x<columns;x++)
        {
            int left=x*texture.Width/columns,right=(x+1)*texture.Width/columns,top=y*texture.Height/rows,bottom=(y+1)*texture.Height/rows;
            if(right<=left || bottom<=top)continue;
            int alpha=0,samples=0;
            for(int sy=top;sy<bottom;sy+=Math.Max(1,(bottom-top)/3))for(int sx=left;sx<right;sx+=Math.Max(1,(right-left)/3)){alpha+=pixels[sy*texture.Width+sx].A;samples++;}
            if(samples>0 && alpha/samples>20)cells.Add((new Rectangle(left,top,right-left,bottom-top),Rank(x,y)));
        }
        cached=new Topology(texture,cells.OrderBy(c=>c.Order).ThenBy(c=>c.Source.Y).ThenBy(c=>c.Source.X).Select(c=>c.Source).ToList());_topologies[texture]=cached;return cached;
    }
    public void Begin(float time,float dt){_time=time;_dt=Math.Clamp(dt,0,.1f);_frame++;}
    public void Clear(){_bodies.Clear();_shards.Clear();}
    public void Draw(SpriteBatch batch,object key,Texture2D texture,Vector2 position,Color tint,float rotation,Vector2 origin,float scale,SpriteEffects effects,float fraction,bool shield=false)
    {
        var topology=GetTopology(texture);int keep=ShieldSpectrum.VoxelCount(fraction,topology.Cells.Count);
        if(!_bodies.TryGetValue(key,out var body)||body.Topology!=topology)
        {body=new Body{Topology=topology,Keep=keep,Spectrum=shield?new ShieldSpectrum():null};_bodies[key]=body;}
        if(keep<body.Keep)Break(body,keep,body.Keep);
        if(shield && keep!=body.Keep){body.Spectrum!.Impulse(.5f,keep>body.Keep?.65f:1.4f);body.Flash=1;}
        body.Frame=_frame;body.Keep=keep;body.Position=position;body.Origin=origin;body.Rotation=rotation;body.Scale=scale;body.Effects=effects;
        if(body.Spectrum!=null){body.Spectrum.Step(_dt);body.Flash*=MathF.Exp(-_dt*4);}
        if(keep==topology.Cells.Count && !shield)
        {batch.Draw(texture,position,null,tint,rotation,origin,scale,effects,0);return;}
        for(int i=0;i<keep;i++)
        {
            var source=topology.Cells[i];Vector2 local=CellCenter(body,source);
            if(shield)
            {
                float phase=(MathF.Atan2(local.Y,local.X)/(MathF.PI*2)+1)%1;
                float wave=body.Spectrum!.Field[(int)(phase*64)%64];
                if(local.LengthSquared()>1)local+=Vector2.Normalize(local)*wave*3;
            }
            Vector2 center=position+Rotate(local,rotation);
            batch.Draw(texture,center,source,shield?Color.Lerp(tint,Color.White,body.Flash*.6f):tint,rotation,new Vector2(source.Width*.5f,source.Height*.5f),scale,effects,0);
        }
    }
    private static Vector2 Rotate(Vector2 p,float a)=>new(p.X*MathF.Cos(a)-p.Y*MathF.Sin(a),p.X*MathF.Sin(a)+p.Y*MathF.Cos(a));
    private static Vector2 CellCenter(Body body,Rectangle source)
    {
        float x=source.X+source.Width*.5f;
        if((body.Effects&SpriteEffects.FlipHorizontally)!=0)x=body.Topology.Texture.Width-x;
        return (new Vector2(x,source.Y+source.Height*.5f)-body.Origin)*body.Scale;
    }
    private void Break(Body body,int from,int to)
    {
        for(int i=from;i<to;i++)
        {
            Rectangle source=body.Topology.Cells[i];Vector2 p=body.Position+Rotate(CellCenter(body,source),body.Rotation);
            float angle=Rank(source.Y,source.X)%6283/1000f;
            _shards.Add(new Shard(body.Topology.Texture,source,p,new Vector2(MathF.Cos(angle)*75-40,MathF.Sin(angle)*75),body.Rotation,(i%9-4)*.8f,body.Scale,_time,body.Spectrum!=null?.65f:1.5f));
        }
        if(_shards.Count>1200)_shards.RemoveRange(0,_shards.Count-1200);
    }
    public void End(SpriteBatch batch,bool emitMissing=true)
    {
        foreach(var key in _bodies.Where(p=>p.Value.Frame!=_frame).Select(p=>p.Key).ToArray())
        {var body=_bodies[key];if(emitMissing&&body.Position.X>-100&&body.Position.X<2050)Break(body,0,body.Keep);_bodies.Remove(key);}
        _shards.RemoveAll(s=>_time-s.Born>=s.Life);
        foreach(var s in _shards)
        {
            float age=_time-s.Born,alpha=Math.Clamp((s.Life-age)*3,0,1);
            batch.Draw(s.Texture,s.Position+s.Velocity*age+new Vector2(0,age*age*18),s.Source,Color.White*alpha,s.Rotation+s.Spin*age,new Vector2(s.Source.Width*.5f,s.Source.Height*.5f),s.Scale,SpriteEffects.None,0);
        }
    }
    public void DrawShield(SpriteBatch batch,object key,Texture2D hull,Vector2 position,Vector2 origin,float scale,float rotation,float fraction,Color tint)
    {
        if(_shield==null)_shield=CreateShield(hull);
        const float width=512,margin=24;float downsample=width/hull.Width;
        Draw(batch,key,_shield,position,tint,rotation,origin*downsample+new Vector2(margin),scale/downsample,SpriteEffects.None,fraction,true);
    }
    private static Texture2D CreateShield(Texture2D hull)
    {
        const int innerWidth=512,margin=24;int innerHeight=(int)MathF.Round(innerWidth*hull.Height/(float)hull.Width),width=innerWidth+margin*2,height=innerHeight+margin*2;
        var input=new Color[hull.Width*hull.Height];hull.GetData(input);var distance=new float[width*height];
        for(int y=0;y<height;y++)for(int x=0;x<width;x++)
        {
            bool inside=x>=margin&&x<width-margin&&y>=margin&&y<height-margin;
            int sx=Math.Clamp((x-margin)*hull.Width/innerWidth,0,hull.Width-1),sy=Math.Clamp((y-margin)*hull.Height/innerHeight,0,hull.Height-1);
            distance[y*width+x]=inside&&input[sy*hull.Width+sx].A>40?0:10000;
        }
        // Two-pass chamfer distance produces an alpha-derived contour once;
        // FFT response and voxel population are updated during drawing.
        for(int y=1;y<height;y++)for(int x=1;x<width;x++){int p=y*width+x;distance[p]=Math.Min(distance[p],Math.Min(distance[p-1]+1,Math.Min(distance[p-width]+1,distance[p-width-1]+1.4142f)));}
        for(int y=height-2;y>=0;y--)for(int x=width-2;x>=0;x--){int p=y*width+x;distance[p]=Math.Min(distance[p],Math.Min(distance[p+1]+1,Math.Min(distance[p+width]+1,distance[p+width+1]+1.4142f)));}
        var output=new Color[width*height];
        for(int i=0;i<output.Length;i++){float d=distance[i],a=d>0?Math.Clamp((13-d)/6,0,1):0;output[i]=new Color(.32f*a,.86f*a,a,a);}
        var texture=new Texture2D(hull.GraphicsDevice,width,height);texture.SetData(output);return texture;
    }
    public void Dispose(){_shield?.Dispose();_shield=null;_topologies.Clear();Clear();}
}
