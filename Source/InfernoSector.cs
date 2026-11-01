using System;
using System.Collections.Generic;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace IronNebula;

// Alpha 0.9.3: playable third sector, built as a separate partial class so no
// Sector 01/02 mechanics or approved textures need to be replaced.
public sealed partial class IronNebulaGame
{
    private const float InfernoDuration=134f;
    private bool _infernoActive;
    private float _infernoElapsed, _infernoFade, _infernoPhaseFade;
    private int _infernoWaveCount, _infernoPhase=-1;
    private readonly Texture2D[] _infernoBackdrops=new Texture2D[3];
    private readonly Texture2D[] _infernoEnemies=new Texture2D[6];
    private readonly Texture2D[,] _infernoDof=new Texture2D[3,3];
    private readonly List<InfernoDrifter> _infernoDrifters=new();

    private sealed class InfernoDrifter
    {
        public int Layer, Variant;
        public float Offset, Y, Speed, Size, Phase, Spin, Rotation;
    }

    private void LoadInfernoContent()
    {
        for(int i=0;i<3;i++) _infernoBackdrops[i]=LoadImage($"Inferno/inferno_backdrop_{i}.jpg");
        for(int i=0;i<6;i++) _infernoEnemies[i]=LoadImage($"Inferno/inferno_enemy_{i}.png");
        string[] distance={"far","mid","near"};
        for(int layer=0;layer<3;layer++)
        for(int i=0;i<3;i++) _infernoDof[layer,i]=LoadImage($"Inferno/inferno_dof_{distance[layer]}_{i}.png");

        LoadInfernoBossContent();
        // Visual-only objects stay off the major combat lanes. Their movement is
        // deterministic and does not affect the RNG used by enemy drops.
        Random scenery=new(93031);
        for(int layer=0;layer<3;layer++)
        for(int i=0;i<(layer==2?2:3);i++)
            _infernoDrifters.Add(new InfernoDrifter
            {
                Layer=layer,Variant=(i+layer)%3,
                Offset=170+scenery.Next(2050),
                Y=(i+layer)%2==0?175+scenery.Next(205):750+scenery.Next(175),
                Speed=(layer==0?9:layer==1?21:37)+scenery.Next(8),
                Size=(layer==0?92:layer==1?140:180)+scenery.Next(32),
                Phase=(float)scenery.NextDouble()*MathHelper.TwoPi,
                Spin=((float)scenery.NextDouble()-.5f)*.018f,
                Rotation=((float)scenery.NextDouble()-.5f)*.35f
            });
    }

    private void BeginInfernoSector()
    {
        _infernoActive=true;
        _riftActive=false;
        _infernoElapsed=0f;_infernoFade=0f;_infernoWaveCount=0;_infernoBossStage=0;
        _infernoPhase=-1;_infernoPhaseFade=1f;
        _bossLaunched=false;_bossFinaleTimer=0f;
        _waveClock=1.9f;_debrisClock=3.6f;
        _enemies.Clear();_shots.Clear();_debris.Clear();_laserLanes.Clear();
        _primaryImpacts.Clear();_primaryReadouts.Clear();
        _pilot.Health=Math.Min(_pilot.MaxHealth,_pilot.Health+1);
        _pilot.Shield=Math.Min(_pilot.MaxShield,_pilot.Shield+1);
        _pilot.Invincible=3f;
        _checkpointUnlocked=true;_checkpointSector=3;
        _checkpointWeaponLevel=_pilot.WeaponLevel;
        _checkpointWeaponMode=_pilot.PrimaryMode;
        _checkpointShield=_pilot.Shield;
        _sectorStartScore=_score;_sectorCreditsEarned=0;
        _sectorCreditPickups=0;_sectorWeaponPickups=0;
        _sectorSupplyPickups=0;_sectorKills=0;_sectorRareCaches=0;_rareCacheSpawns=0;
        CaptureEconomyCheckpoint();
        _audio?.StartTransitionDuck();
        _audio?.Effect("sector_transition",1.5f,.75f);
        Alert("SECTOR 03  -  INFERNO BELT",4.3f);
        _formationNotice="OUTER BELT APPROACH";
        _formationNoticeTime=3.5f;
    }

    private static bool IsInfernoEnemy(EnemyKind kind) =>
        kind>=EnemyKind.InfernoScorch && kind<=EnemyKind.InfernoGunship;

    private void UpdateInfernoSector(float dt)
    {
        // Freeze the stage clock during boss encounters. Later encounters
        // cannot trigger until the active boss has been defeated.
        if(_infernoBossStage!=1 && _infernoBossStage!=3 && _infernoBossStage!=4)
            _infernoElapsed+=dt;
        _infernoFade=MathHelper.Clamp(_infernoFade+dt*.33f,0f,1f);
        if(_infernoBossStage==0 && _infernoElapsed>=InfernoGuardianAt)
        {
            SpawnInfernoBoss(false);
            return;
        }
        if(_infernoBossStage==2 && _infernoElapsed>=InfernoTitanAt)
        {
            SpawnInfernoBoss(true);
            return;
        }
        bool activeBoss=_infernoBossStage==1 || _infernoBossStage==3 || _infernoBossStage==4;
        if(activeBoss) return;
        int phase=_infernoElapsed<44f?0:_infernoElapsed<92f?1:2;
        if(phase!=_infernoPhase)
        {
            _infernoPhase=phase;
            _infernoPhaseFade=0f;
            _formationNotice=phase switch
            {
                0=>"INFERNO  -  OUTER BELT",
                1=>"BROKEN FLEET  -  WRECK FIELD",
                _=>"INFERNO CORE  -  HIGH RADIATION"
            };
            _formationNoticeTime=3f;
            Alert(_formationNotice,2.6f);
        }
        _infernoPhaseFade=MathHelper.Clamp(_infernoPhaseFade+dt*.45f,0f,1f);
        if(_infernoElapsed<InfernoTitanAt-12f && _waveClock<=0f)
        {
            if(_enemies.Count<14)
            {
                SpawnInfernoWave();
                _waveClock=phase==0?3.8f:phase==1?3.35f:2.90f;
            }
            else _waveClock=.9f;
        }
        if(_infernoElapsed<InfernoTitanAt-14f)
        {
            _debrisClock-=dt;
            if(_debrisClock<=0f)
            {
                SpawnInfernoMeteor();
                _debrisClock=phase==0?6.8f:phase==1?4.6f:4.0f;
            }
        }
        // Titan destruction triggers the existing multi-burst death finale,
        // which is the only normal route to the Sector 03 debrief/shop.
    }

    private void SpawnInfernoWave()
    {
        int pattern=_infernoWaveCount++%8;
        if(_infernoWaveCount%9==0 && _rareCacheSpawns<2)
        {
            SpawnRareCreditCache(new Vector2(ViewWidth-135,MathHelper.Clamp(_pilot.Position.Y+125f,260f,800f)),285);
            _rareCacheSpawns++;
        }
        string[] labels={"SCORCH INTERCEPTORS","LAVA DRONE PHALANX",
            "ASH BOMBER SCREEN","MAGMA TANK ESCORT","WRECK HUNTER AMBUSH",
            "INFERNO GUNSHIP VOLLEY","CROSSING FIRE","INFERNO MIXED SQUADRON"};
        _formationNotice=labels[pattern];_formationNoticeTime=2.2f;
        if(_infernoWaveCount%3==0)
            SpawnCreditPickup(new Vector2(ViewWidth-155,Rand(280f,780f)),135);
        if(_infernoWaveCount%5==0 && _pilot.WeaponLevel<Pilot.MaxWeaponLevel)
            _pickups.Add(new Pickup
            {
                Kind=PickupKind.Weapon,
                Position=new Vector2(ViewWidth+75,MathHelper.Clamp(_pilot.Position.Y,235f,830f)),
                Velocity=new Vector2(-77f,0f)
            });
        int count=pattern==3?3:pattern==5?3:pattern==7?5:4;
        float lockY=MathHelper.Clamp(_pilot.Position.Y,250f,835f);
        for(int i=0;i<count;i++)
        {
            EnemyKind kind=pattern switch
            {
                0=>EnemyKind.InfernoScorch,
                1=>EnemyKind.InfernoLavaDrone,
                2=>i==2?EnemyKind.InfernoBomber:EnemyKind.InfernoScorch,
                3=>i==1?EnemyKind.InfernoTank:EnemyKind.InfernoLavaDrone,
                4=>EnemyKind.InfernoWreckHunter,
                5=>EnemyKind.InfernoGunship,
                6=>i%2==0?EnemyKind.InfernoScorch:EnemyKind.InfernoWreckHunter,
                _=>(EnemyKind)((int)EnemyKind.InfernoScorch+i%6)
            };
            float y=pattern==6?(i%2==0?260f:810f):290f+i%3*235f+(i/3)*50f;
            float targetY=MathHelper.Clamp(lockY+(i-(count-1)*.5f)*57f,190f,900f);
            SpawnInfernoEnemy(kind,new Vector2(ViewWidth+155+i*148f,y),i*.67f,targetY);
        }
    }

    private void SpawnInfernoEnemy(EnemyKind kind,Vector2 position,float phase,float targetY)
    {
        int hp=kind switch
        {
            EnemyKind.InfernoTank=>16,EnemyKind.InfernoBomber=>10,
            EnemyKind.InfernoGunship=>8,EnemyKind.InfernoWreckHunter=>6,
            EnemyKind.InfernoLavaDrone=>5,_=>4
        };
        float speed=kind switch
        {
            EnemyKind.InfernoTank=>154f,EnemyKind.InfernoBomber=>176f,
            EnemyKind.InfernoGunship=>214f,EnemyKind.InfernoWreckHunter=>340f,
            EnemyKind.InfernoScorch=>380f,_=>285f
        };
        float radius=kind==EnemyKind.InfernoTank?73f:
            kind==EnemyKind.InfernoBomber?64f:kind==EnemyKind.InfernoGunship?57f:42f;
        _enemies.Add(new Enemy
        {
            Kind=kind,Position=position,BaseY=position.Y,TargetY=targetY,
            Phase=phase,Speed=speed,Health=hp,MaxHealth=hp,Radius=radius,
            FireTimer=Rand(.8f,2.3f),MotionPattern=40+(int)kind-(int)EnemyKind.InfernoScorch
        });
    }

    private void UpdateInfernoEnemy(Enemy enemy,float dt)
    {
        enemy.Position.X-=enemy.Speed*dt;
        float age=enemy.Age;
        if(enemy.Kind==EnemyKind.InfernoScorch)
            enemy.Position.Y=enemy.BaseY+MathF.Sin(age*4.7f+enemy.Phase)*43f;
        else if(enemy.Kind==EnemyKind.InfernoLavaDrone)
            enemy.Position.Y=enemy.BaseY+MathF.Sin(age*3.5f+enemy.Phase)*105f;
        else if(enemy.Kind==EnemyKind.InfernoBomber)
            enemy.Position.Y=enemy.BaseY+MathF.Sin(age*1.48f+enemy.Phase)*36f;
        else if(enemy.Kind==EnemyKind.InfernoTank)
            enemy.Position.Y=enemy.BaseY+MathF.Sin(age*1.27f+enemy.Phase)*26f;
        else if(enemy.Kind==EnemyKind.InfernoWreckHunter)
        {
            float t=MathHelper.Clamp((age-.1f)/2.2f,0f,1f);
            t=t*t*(3f-2f*t);
            enemy.Position.Y=MathHelper.Lerp(enemy.BaseY,enemy.TargetY,t)+MathF.Sin(age*5.2f+enemy.Phase)*27f;
        }
        else
            enemy.Position.Y=enemy.BaseY+MathF.Sin(age*2.3f+enemy.Phase)*68f;
        enemy.Position.Y=MathHelper.Clamp(enemy.Position.Y,175f,900f);
        enemy.FireTimer-=dt/DifficultyShotTimeFactor;
        if(enemy.FireTimer>0 || enemy.Position.X>ViewWidth-150 || enemy.Position.X<170) return;
        Vector2 muzzle=enemy.Position-new Vector2(45,0);
        if(enemy.Kind==EnemyKind.InfernoScorch)
            AimFire(muzzle,new Vector2(-455f,0),9f);
        else if(enemy.Kind==EnemyKind.InfernoLavaDrone)
        {
            for(int side=-1;side<=1;side+=2)
                CreateShot(muzzle+new Vector2(0,side*21),new Vector2(-425f,side*115f),false,1,10f,Color.OrangeRed);
        }
        else if(enemy.Kind==EnemyKind.InfernoBomber)
        {
            for(int i=-1;i<=1;i++)
                CreateShot(muzzle,new Vector2(-332f,i*130f),false,1,13f,Color.Orange);
        }
        else if(enemy.Kind==EnemyKind.InfernoTank)
        {
            for(int i=-1;i<=1;i++)
                CreateShot(muzzle+new Vector2(0,i*28),new Vector2(-320f,i*91f),false,1,14f,Color.OrangeRed);
        }
        else if(enemy.Kind==EnemyKind.InfernoWreckHunter)
            AimFire(muzzle,new Vector2(-450f,0),10f);
        else
        {
            for(int i=-2;i<=2;i++)
                CreateShot(muzzle,new Vector2(-405f,i*73f),false,1,11f,Color.OrangeRed);
        }
        SpawnCombatFlash(muzzle,-Vector2.UnitX,Color.Orange,25f,.12f);
        enemy.FireTimer=enemy.Kind switch
        {
            EnemyKind.InfernoScorch=>2.30f,EnemyKind.InfernoTank=>2.45f,
            EnemyKind.InfernoGunship=>2.15f,EnemyKind.InfernoLavaDrone=>2.7f,
            _=>2.55f
        };
    }

    private void SpawnInfernoMeteor()
    {
        if(_debris.Count>=3) return;
        float r=Rand(40f,64f);
        _debris.Add(new Debris
        {
            Position=new Vector2(ViewWidth+r+50,Rand(220f,880f)),
            Velocity=new Vector2(-Rand(180f,240f),Rand(-14f,14f)),
            Radius=r,Health=r>53f?4:3,Variant=_random.Next(0,12),
            Rotation=Rand(0f,MathHelper.TwoPi),Spin=Rand(-.6f,.6f)
        });
    }

    private void DrawInfernoBackground()
    {
        int phase=Math.Clamp(_infernoPhase,0,2);
        DrawEndlessBackdrop(_spaceBackdrops[2],Color.White*_infernoFade);
        // Short, unintrusive transition between phases. No giant full-screen flash.
        if(phase>0 && _infernoPhaseFade<1f)
            DrawEndlessBackdrop(_spaceBackdrops[2],Color.White*(1f-_infernoPhaseFade));
        _ui.Rect(_batch,new Rectangle(0,0,ViewWidth,ViewHeight),new Color(9,1,1,13));
    }

    private void DrawInfernoDrifters()
    {
        float wrap=ViewWidth+800f;
        foreach(InfernoDrifter item in _infernoDrifters)
        {
            Texture2D sprite=_infernoDof[item.Layer,item.Variant];
            float x=(item.Offset+wrap*15f-_infernoElapsed*item.Speed)%wrap-325f;
            float y=item.Y+MathF.Sin(_infernoElapsed*.13f+item.Phase)*8f;
            float scale=item.Size/sprite.Width;
            _batch.Draw(sprite,new Vector2(x,y),null,Color.White*.82f,
                item.Rotation+item.Spin*_infernoElapsed,
                new Vector2(sprite.Width*.5f,sprite.Height*.5f),scale,SpriteEffects.None,0f);
        }
    }
}
