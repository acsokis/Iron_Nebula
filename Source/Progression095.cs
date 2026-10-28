using System;

namespace IronNebula;

// Economy 3.0: simple performance tiers, repeat-safe sector bonuses and
// contextual before/after equipment stats; no additional gameplay dependencies.
public sealed partial class IronNebulaGame
{
    private static string ComputeSectorRank(int kills,int hull,int maxHull,int pickups,bool unranked)
    {
        if(unranked) return "TEST";
        if(kills>=85 && hull>=maxHull-1 && pickups>=7) return "S";
        if(kills>=55 && hull>=Math.Max(1,maxHull-2)) return "A";
        if(kills>=28) return "B";
        return "C";
    }

    private static int SectorRankBonus(string rank,bool rift,bool inferno)
    {
        // Sector One retains the 900-credit limit and has no rank cash bonus.
        if(!rift && !inferno) return 0;
        int scale=inferno?2:1;
        return rank switch
        {
            "S"=>225*scale,
            "A"=>145*scale,
            "B"=>75*scale,
            _=>0
        };
    }

    private string ShopItemStatLine(int i)=>i switch
    {
        0=>"BALANCED  /  PARALLEL FIRE",
        1=>"FAST  /  PENETRATING",
        2=>"WIDE COVERAGE  /  PLASMA",
        3=>"HIGH FIRE RATE  /  LOW DAMAGE",
        4=>"SINGLE CONTINUOUS BEAM",
        5=>"LIVES  "+_pilot.Lives+" / 6",
        6=>"SHIELD  "+_pilot.MaxShield+" / 5",
        7=>"HULL  "+_pilot.MaxHealth+" / 6",
        8=>"DRONE  "+_pilot.DroneUpgrade+" / 2",
        9=>"SHIELD CHARGE  "+_pilot.Shield+" / "+_pilot.MaxShield,
        10=>"MAGNET  "+_pilot.PickupMagnetLevel+" / 2",
        11=>"DAMAGE  "+(_pilot.WeaponPowerLevel==0?"BASE":_pilot.WeaponPowerLevel==1?"+1 / 2 HITS":"+1 / HIT")+"  ("+_pilot.WeaponPowerLevel+" / 2)",
        12=>"MOVE SPEED  "+(100+8*_pilot.EngineLevel)+"% -> "+(100+8*Math.Min(2,_pilot.EngineLevel+1))+"%",
        _=>""
    };
}