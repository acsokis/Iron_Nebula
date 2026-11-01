using Microsoft.Xna.Framework;

namespace IronNebula;

public sealed partial class IronNebulaGame
{
    private readonly Dictionary<int,(List<(float X,float Y)> Path,float Next)> _flightRoutes=new();
    private List<SpacePhysics.Body> NativeBodies()
    {
        var bodies=new List<SpacePhysics.Body>();
        if(CoopActive&&_coopHost!=null)
        {foreach(var actor in _party.Values)if(actor.Pilot.Lives>0)bodies.Add(PilotBody(actor.Pilot,actor.Id));}
        else if(_pilot.Lives>0)bodies.Add(PilotBody(_pilot,0));
        foreach(var e in _enemies)if(e.Health>0&&e.Parent==null)bodies.Add(new(){Id=e.VisualId,X=e.Position.X,Y=e.Position.Y,Radius=e.Radius,Half=e.Radius*.3f,Tag=e});
        foreach(var r in _debris)if(r.Health>0)bodies.Add(new(){Id=r.VisualId,X=r.Position.X,Y=r.Position.Y,Radius=r.Radius,Tag=r});
        return bodies;
    }
    private static SpacePhysics.Body PilotBody(Pilot p,int id)=>new(){Id=-100-id,X=p.Position.X,Y=p.Position.Y,Radius=40,Half=90,Player=true,Tag=p};
    private Dictionary<int,Vector2> CaptureNativeBodies()=>NativeBodies().ToDictionary(b=>b.Id,b=>new Vector2(b.X,b.Y));
    private void ResolveNativeBodies(Dictionary<int,Vector2> previous,float dt)
    {
        var bodies=NativeBodies();var destinations=bodies.ToDictionary(b=>b.Id,b=>new Vector2(b.X,b.Y));
        foreach(var b in bodies)if(previous.TryGetValue(b.Id,out var p)){b.X=p.X;b.Y=p.Y;}
        foreach(var b in bodies)
        {
            if(!previous.ContainsKey(b.Id))
            {
                if(b.Tag is Enemy entering&&!(_coopSmoke&&entering.BaseY>=10000))b.X=Math.Max(b.X,ViewWidth+b.Radius+b.Half+48);
                bool clear=!bodies.Any(o=>SpacePhysics.Collides(b,o)&&SpacePhysics.Overlap(b,o));
                for(int attempt=0;!clear&&attempt<24;attempt++)
                {b.Y=220+attempt%6*125;b.X=Math.Max(destinations[b.Id].X,ViewWidth+b.Radius+b.Half+48)+(attempt/6)*80;clear=!bodies.Any(o=>SpacePhysics.Collides(b,o)&&SpacePhysics.Overlap(b,o));}
                if(!clear){if(b.Tag is Enemy rejected)rejected.Health=0;else if(b.Tag is Debris debris)debris.Health=0;continue;}
                destinations[b.Id]=new Vector2(b.X,b.Y);
            }
            Vector2 goal=destinations[b.Id],motion=goal-new Vector2(b.X,b.Y);
            if(b.Player){goal.X=Math.Clamp(goal.X,130,1770);goal.Y=Math.Clamp(goal.Y,180,930);motion=goal-new Vector2(b.X,b.Y);}
            else if(b.Tag is Enemy enemy&&enemy.Parent==null&&enemy.Radius<100)
            {
                bool blocked=bodies.Any(o=>SpacePhysics.Collides(b,o)&&SpacePhysics.Sweep(b,-180,0,o).HasValue);
                if(blocked)
                {
                    if(!_flightRoutes.TryGetValue(b.Id,out var route)||_travel>=route.Next){route=(SpacePhysics.Path(b,b.X-400,Math.Clamp(enemy.BaseY,210,900),bodies),_travel+.25f+b.Id%5*.02f);_flightRoutes[b.Id]=route;}
                    while(route.Path.Count>0&&Vector2.Distance(new Vector2(b.X,b.Y),new Vector2(route.Path[0].X,route.Path[0].Y))<18)route.Path.RemoveAt(0);
                    motion=Vector2.Zero;
                    if(route.Path.Count>0){motion=new Vector2(route.Path[0].X-b.X,route.Path[0].Y-b.Y);if(motion.LengthSquared()>0)motion=Vector2.Normalize(motion)*Math.Max(30,enemy.Speed)*dt;}
                }
            }
            SpacePhysics.Move(b,motion.X,motion.Y,bodies);var position=new Vector2(b.X,b.Y);
            if(b.Tag is Pilot pilot)pilot.Position=position;else if(b.Tag is Enemy enemyBody)enemyBody.Position=position;else if(b.Tag is Debris rock)rock.Position=position;
        }
        foreach(var module in _enemies.Where(e=>e.Parent!=null))module.Position=module.Parent!.Position+module.MountOffset;
        var live=bodies.Select(b=>b.Id).ToHashSet();foreach(var id in _flightRoutes.Keys.Where(id=>!live.Contains(id)).ToArray())_flightRoutes.Remove(id);
    }
}
