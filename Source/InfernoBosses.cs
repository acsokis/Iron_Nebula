using System;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace IronNebula;

// Alpha 0.9.4: both Inferno bosses have independent destructible weapon pylons.
// Uses the existing collision, projectile, explosion and credit systems.
public sealed partial class IronNebulaGame
{
    private const float InfernoGuardianAt=56f;
    private const float InfernoTitanAt=134f;
    // 0: Guardian pending, 1: Guardian active, 2: Guardian destroyed,
    // 3: Titan active, 4: Titan destroyed / finale.
    private int _infernoBossStage;
    private Texture2D _infernoGuardianSprite=null!;
    private Texture2D _infernoTitanSprite=null!;
    private Texture2D _infernoTurretSprite=null!;

    private static bool IsInfernoBoss(EnemyKind kind)=>
        kind==EnemyKind.InfernoGuardian || kind==EnemyKind.InfernoTitan;

    private void LoadInfernoBossContent()
    {
        _infernoGuardianSprite=LoadImage("Inferno/inferno_guardian_boss.png");
        _infernoTitanSprite=LoadImage("Inferno/inferno_titan_boss.png");
        _infernoTurretSprite=LoadImage("Inferno/inferno_boss_turret.png");
    }

    private void SpawnInfernoBoss(bool titan)
    {
        _infernoBossStage=titan?3:1;
        _enemies.Clear();
        _debris.Clear();
        _laserLanes.Clear();
        _shots.RemoveAll(s=>!s.Friendly);
        var leader=new Enemy
        {
            Kind=titan?EnemyKind.InfernoTitan:EnemyKind.InfernoGuardian,
            Position=new Vector2(ViewWidth+340f,540f),
            BaseY=540f,Speed=titan?110f:156f,
            Radius=titan?168f:132f,
            Health=titan?390:165,MaxHealth=titan?390:165,
            FireTimer=1.55f
        };
        _enemies.Add(leader);
        int count=titan?4:2;
        for(int i=0;i<count;i++)
        {
            Vector2 offset=titan?
                new Vector2((i%2==0?-145f:100f),i<2?-172f:172f):
                new Vector2(-118f,i==0?-132f:132f);
            _enemies.Add(new Enemy
            {
                Kind=EnemyKind.InfernoBossTurret,Parent=leader,
                MountOffset=offset,Position=leader.Position+offset,
                Radius=titan?34f:29f,Health=titan?36:23,
                MaxHealth=titan?36:23,FireTimer=1.8f+i*.32f
            });
        }
        _pilot.Invincible=MathF.Max(_pilot.Invincible,2f);
        _bossLaunched=true;
        _waveClock=4f;
        _formationNotice=titan?"INFERNO TITAN":"INFERNO GUARDIAN";
        _formationNoticeTime=3.5f;
        Alert(titan?"WARNING  -  INFERNO TITAN":"INFERNO GUARDIAN  -  INCOMING",3.8f);
        _audio?.Effect("boss",.2f);
    }

    private void UpdateInfernoBoss(Enemy enemy,float dt)
    {
        if(enemy.Kind==EnemyKind.InfernoBossTurret)
        {
            Enemy? parent=enemy.Parent;
            if(parent==null || !_enemies.Contains(parent))
            {
                _enemies.Remove(enemy);
                return;
            }
            enemy.Position=parent.Position+enemy.MountOffset;
            enemy.FireTimer-=dt/DifficultyShotTimeFactor;
            if(parent.Position.X<1580 && enemy.FireTimer<=0)
            {
                Vector2 start=enemy.Position-new Vector2(24f,0f);
                AimFire(start,new Vector2(-440f,0f),11f);
                SpawnCombatFlash(start,-Vector2.UnitX,Color.OrangeRed,28f,.12f);
                enemy.FireTimer=2.4f+enemy.FireCycle%2*.38f;
                enemy.FireCycle++;
            }
            return;
        }

        bool titan=enemy.Kind==EnemyKind.InfernoTitan;
        float anchor=titan?1500f:1480f;
        if(enemy.Position.X>anchor)
            enemy.Position.X=MathF.Max(anchor,enemy.Position.X-enemy.Speed*dt);
        else
            enemy.Position.Y=540f+MathF.Sin(enemy.Age*(titan?.73f:1.1f))*(titan?122f:150f);

        int phase=titan?
            enemy.Health<=enemy.MaxHealth*.31f?3:enemy.Health<=enemy.MaxHealth*.67f?2:1:
            enemy.Health<=enemy.MaxHealth*.49f?2:1;
        if(phase>enemy.LastPhase)
        {
            enemy.LastPhase=phase;
            OnBossPhaseChanged(enemy,phase);
            _shake=MathF.Max(_shake,17f);
            Boom(enemy.Position+new Vector2(-85f,0f),29,Color.OrangeRed);
            Alert(titan?"INFERNO TITAN  -  PHASE "+phase:
                "INFERNO GUARDIAN  -  OVERDRIVE",2.8f);
            // Escort pressure during the final phase; bounded by enemy count.
            if(titan && phase==3 && _enemies.Count<12)
            {
                SpawnInfernoEnemy(EnemyKind.InfernoScorch,new Vector2(ViewWidth+90,250),0f,250);
                SpawnInfernoEnemy(EnemyKind.InfernoScorch,new Vector2(ViewWidth+245,795),1.0f,795);
            }
        }
        enemy.FireTimer-=dt/DifficultyShotTimeFactor;
        if(enemy.Position.X<=anchor && enemy.FireTimer<=0f)
        {
            FireInfernoBoss(enemy,phase);
            enemy.FireTimer=titan?
                phase==3?.88f:phase==2?1.22f:1.60f:
                phase==2?1.02f:1.65f;
        }
    }

    private void FireInfernoBoss(Enemy boss,int phase)
    {
        bool titan=boss.Kind==EnemyKind.InfernoTitan;
        int count=titan?(phase==3?11:phase==2?9:7):(phase==2?7:5);
        float spread=titan?(phase==3?1.91f:1.45f):1.20f;
        Vector2 origin=boss.Position+new Vector2(titan?-174f:-124f,0f);
        float aim=MathF.Atan2(_pilot.Position.Y-origin.Y,_pilot.Position.X-origin.X);
        for(int i=0;i<count;i++)
        {
            float angle=aim+(i-(count-1)*.5f)*(spread/Math.Max(1,count-1));
            Vector2 direction=new(MathF.Cos(angle),MathF.Sin(angle));
            CreateShot(origin,direction*(titan?phase==3?455f:405f:375f),
                false,1,titan?13f:11f,Color.OrangeRed);
        }
        SpawnCombatFlash(origin,-Vector2.UnitX,Color.Orange,78f,.18f);
        // A clearly telegraphed horizontal beam: fixed lane, dodgeable warning.
        if(phase>=2 && ++boss.FireCycle%(titan?3:4)==0 && _laserLanes.Count==0)
        {
            _laserLanes.Add(new LaserLane
            {
                Y=MathHelper.Clamp(_pilot.Position.Y,220f,ViewHeight-160f),
                Warning=1.55f,Active=.60f
            });
            Alert("WARNING  -  INFERNO BEAM",1.3f);
            _audio?.Effect("boss_warning",.65f,.76f);
        }
    }

    private void DrawInfernoBoss(Enemy enemy,Vector2 artPos,Color tint)
    {
        Texture2D sprite=enemy.Kind switch
        {
            EnemyKind.InfernoGuardian=>_infernoGuardianSprite,
            EnemyKind.InfernoTitan=>_infernoTitanSprite,
            _=>_infernoTurretSprite
        };
        float scale=enemy.Kind switch
        {
            EnemyKind.InfernoTitan=>.67f,
            EnemyKind.InfernoGuardian=>.68f,
            _=>.48f
        };
        _voxelVisuals.Draw(_batch,enemy.VisualId,sprite,artPos,tint,0f,
            new Vector2(sprite.Width*.5f,sprite.Height*.5f),scale,SpriteEffects.None,enemy.Health/(float)Math.Max(1,enemy.MaxHealth));
        float lost=1f-enemy.Health/(float)Math.Max(1,enemy.MaxHealth);
        if(lost>.35f && enemy.Kind!=EnemyKind.InfernoBossTurret)
            _batch.Draw(_redGlow,artPos+new Vector2(4,3),null,
                Color.OrangeRed*((lost-.35f)*.12f),0f,
                new Vector2(_redGlow.Width*.5f,_redGlow.Height*.5f),.68f,SpriteEffects.None,0f);
    }
}
