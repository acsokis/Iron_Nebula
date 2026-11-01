using System.Numerics;
using IronNebula;

int checks=0;
void Check(bool condition,string label){checks++;if(!condition)throw new Exception(label);}
var signal=Enumerable.Range(0,64).Select(i=>new Complex(Math.Exp(-Math.Pow(i-21,2)/8),0)).ToArray();
var original=(Complex[])signal.Clone();ShieldSpectrum.Fft(signal);ShieldSpectrum.Fft(signal,true);
Check(signal.Zip(original).All(p=>(p.First-p.Second).Magnitude<1e-10),"FFT round trip preserves the impulse");
var spectrum=new ShieldSpectrum();spectrum.Impulse(.25f,1);
for(int i=0;i<12;i++)spectrum.Step(1f/60);
double energy=spectrum.Field.Sum(v=>v*v);Check(energy>.0001,"Impact creates a visible wave");
Check(spectrum.Field.Where((_,i)=>i!=16).Any(v=>Math.Abs(v)>.01),"Wave propagates away from contact");
for(int i=0;i<600;i++)spectrum.Step(1f/60);
Check(spectrum.Field.All(float.IsFinite)&&spectrum.Field.Sum(v=>v*v)<energy*.001,"Damping removes wave energy without instability");
foreach(int total in new[]{1,397,2048})
{
    Check(ShieldSpectrum.VoxelCount(1,total)==total,"Full health/shield retains every voxel");
    Check(ShieldSpectrum.VoxelCount(0,total)==0,"Zero health/shield retains no voxels");
    Check(ShieldSpectrum.VoxelCount(.5f,total)==(int)MathF.Round(total*.5f,MidpointRounding.AwayFromZero),"Half health/shield retains half the topology");
}
var mover=new SpacePhysics.Body {Id=1,X=0,Y=540,Radius=10,Half=10};
var obstacle=new SpacePhysics.Body {Id=2,X=100,Y=540,Radius=20};
SpacePhysics.Move(mover,1000,0,new[]{obstacle});
Check(mover.X<=60.001f&&!SpacePhysics.Overlap(mover,obstacle),"Swept movement cannot tunnel through an obstacle");
SpacePhysics.Move(mover,30,80,new[]{obstacle});Check(mover.Y>540&&!SpacePhysics.Overlap(mover,obstacle),"Hull slides at contact");
mover.Player=obstacle.Player=true;Check(!SpacePhysics.Collides(mover,obstacle),"Players are excluded from player collision");
mover.Player=obstacle.Player=false;mover.X=0;mover.Y=540;obstacle.X=128;obstacle.Radius=45;
var route=SpacePhysics.Path(mover,256,540,new[]{obstacle});Check(route.Count>1,"Flight path routes around a solid obstacle");
foreach(var point in route){Check(!SpacePhysics.Sweep(mover,point.X-mover.X,point.Y-mover.Y,obstacle).HasValue,"Every route edge clears the full body corridor");mover.X=point.X;mover.Y=point.Y;}
Console.WriteLine($"PASS: {checks} native FFT, voxel population, collision and flight-path checks");
