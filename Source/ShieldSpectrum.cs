using System;
using System.Numerics;

namespace IronNebula;

internal sealed class ShieldSpectrum
{
    private readonly Complex[] _position=new Complex[64],_velocity=new Complex[64];
    public readonly float[] Field=new float[64];
    public static int VoxelCount(float fraction,int total)=>(int)MathF.Round(Math.Clamp(float.IsFinite(fraction)?fraction:0f,0f,1f)*total,MidpointRounding.AwayFromZero);
    public static void Fft(Complex[] values,bool inverse=false)
    {
        int n=values.Length;
        if(n<2 || (n&(n-1))!=0) throw new ArgumentException("FFT length must be a power of two.");
        for(int i=1,j=0;i<n;i++)
        {
            int bit=n>>1;for(;(j&bit)!=0;bit>>=1)j^=bit;j^=bit;
            if(i<j)(values[i],values[j])=(values[j],values[i]);
        }
        for(int size=2;size<=n;size*=2)
        for(int start=0;start<n;start+=size)
        for(int j=0;j<size/2;j++)
        {
            int a=start+j,b=a+size/2;
            Complex term=values[b]*Complex.FromPolarCoordinates(1,(inverse?2:-2)*Math.PI*j/size);
            values[b]=values[a]-term;values[a]+=term;
        }
        if(inverse)for(int i=0;i<n;i++)values[i]/=n;
    }
    public void Impulse(float phase,float strength)
    {
        var impulse=new Complex[64];double center=((phase%1+1)%1)*64;
        for(int i=0;i<64;i++){double d=Math.Min(Math.Abs(i-center),64-Math.Abs(i-center));impulse[i]=Math.Exp(-d*d/8)*strength*24;}
        Fft(impulse);for(int i=1;i<64;i++)_velocity[i]+=impulse[i];
    }
    public void Step(float dt)
    {
        dt=Math.Clamp(dt,0,.1f);int steps=Math.Max(1,(int)Math.Ceiling(dt*120));double h=dt/steps,damping=Math.Exp(-h*4);
        for(int step=0;step<steps;step++)for(int k=1;k<64;k++)
        {double frequency=70*Math.Sin(Math.PI*k/64);_velocity[k]=(_velocity[k]-_position[k]*frequency*frequency*h)*damping;_position[k]+=_velocity[k]*h;}
        var spatial=(Complex[])_position.Clone();Fft(spatial,true);
        for(int i=0;i<64;i++)Field[i]=(float)Math.Clamp(spatial[i].Real,-1,1);
    }
}
