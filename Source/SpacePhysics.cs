using System;
using System.Collections.Generic;
using System.Linq;

namespace IronNebula;

internal static class SpacePhysics
{
    internal sealed class Body
    {
        public int Id;
        public float X,Y,Radius,Half;
        public bool Player;
        public object Tag=null!;
    }
    internal readonly record struct Hit(float Time,float X,float Y);
    internal static bool Collides(Body a,Body b)=>a.Id!=b.Id&&!(a.Player&&b.Player);
    internal static bool Overlap(Body a,Body b)
    {float x=Math.Max(0,Math.Abs(a.X-b.X)-a.Half-b.Half),y=a.Y-b.Y,r=a.Radius+b.Radius;return x*x+y*y<r*r-.0001f;}
    internal static Hit? Sweep(Body a,float dx,float dy,Body b)
    {
        float x=a.X-b.X,y=a.Y-b.Y,h=a.Half+b.Half,r=a.Radius+b.Radius;Hit? best=null;
        void Candidate(float t,float nx,float ny)
        {if(t>=-.0000001f&&t<=1&&dx*nx+dy*ny<-.0000001f&&(!best.HasValue||t<best.Value.Time))best=new(Math.Max(0,t),nx,ny);}
        if(dy!=0)foreach(int side in new[]{-1,1}){float t=(side*r-y)/dy,px=x+dx*t;if(px>=-h&&px<=h)Candidate(t,0,side);}
        float aa=dx*dx+dy*dy;
        if(aa>1e-10f)foreach(float end in new[]{-h,h})
        {
            float ox=x-end,bb=2*(ox*dx+y*dy),cc=ox*ox+y*y-r*r,disc=bb*bb-4*aa*cc;
            if(disc<0)continue;float t=(-bb-MathF.Sqrt(disc))/(2*aa),px=x+dx*t-end,py=y+dy*t;
            if((end<=0&&px<=0)||(end>=0&&px>=0)||h==0)Candidate(t,px/r,py/r);
        }
        return best;
    }
    internal static void Move(Body body,float dx,float dy,IReadOnlyList<Body> obstacles)
    {
        for(int iteration=0;iteration<4&&Math.Abs(dx)+Math.Abs(dy)>.00001f;iteration++)
        {
            Hit? first=null;
            foreach(var other in obstacles)if(Collides(body,other))
            {var hit=Sweep(body,dx,dy,other);if(hit.HasValue&&(!first.HasValue||hit.Value.Time<first.Value.Time))first=hit;}
            if(!first.HasValue){body.X+=dx;body.Y+=dy;return;}
            var contact=first.Value;float t=Math.Max(0,contact.Time-.00001f);body.X+=dx*t;body.Y+=dy*t;dx*=1-t;dy*=1-t;
            float inward=Math.Min(0,dx*contact.X+dy*contact.Y);dx-=inward*contact.X;dy-=inward*contact.Y;
        }
    }
    private static bool Clear(Body body,float x,float y,IReadOnlyList<Body> obstacles)
    {
        var target=new Body {Id=body.Id,X=x,Y=y,Radius=body.Radius,Half=body.Half,Player=body.Player};
        return !obstacles.Any(o=>Collides(body,o)&&(Overlap(body,o)||Overlap(target,o)||Sweep(body,x-body.X,y-body.Y,o).HasValue));
    }
    private sealed record Node(float X,float Y,float Cost,Node? Parent);
    internal static List<(float X,float Y)> Path(Body body,float x,float y,IReadOnlyList<Body> obstacles)
    {
        if(Clear(body,x,y,obstacles))return new(){(x,y)};
        var open=new PriorityQueue<Node,float>();open.Enqueue(new(body.X,body.Y,0,null),0);var visited=new Dictionary<(int,int),float>();int expanded=0;
        while(open.Count>0&&expanded++<180)
        {
            var node=open.Dequeue();var probe=new Body {Id=body.Id,X=node.X,Y=node.Y,Radius=body.Radius,Half=body.Half};
            if(Clear(probe,x,y,obstacles)){var path=new List<(float,float)>{(x,y)};for(var n=node;n.Parent!=null;n=n.Parent)path.Insert(0,(n.X,n.Y));return path;}
            for(int oy=-1;oy<=1;oy++)for(int ox=-1;ox<=1;ox++)
            {
                if(ox==0&&oy==0)continue;int gx=(int)MathF.Round(node.X/64)+ox,gy=(int)MathF.Round(node.Y/64)+oy;
                float nx=gx*64,ny=gy*64;if(nx< -256||nx>2304||ny<190||ny>920)continue;
                float g=node.Cost+MathF.Sqrt((nx-node.X)*(nx-node.X)+(ny-node.Y)*(ny-node.Y));
                if(g>=visited.GetValueOrDefault((gx,gy),float.PositiveInfinity)||!Clear(probe,nx,ny,obstacles))continue;
                visited[(gx,gy)]=g;open.Enqueue(new(nx,ny,g,node),g+MathF.Sqrt((x-nx)*(x-nx)+(y-ny)*(y-ny)));
            }
        }
        return new();
    }
}
