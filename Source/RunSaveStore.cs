using System;
using System.IO;
using System.Text.Json;

namespace IronNebula;

/// <summary>Persist only deterministic sector-boundary state, never live projectiles.</summary>
internal sealed class RunSaveData
{
    public int Schema { get; set; } = 1;
    public string Stage { get; set; } = "Checkpoint"; // Checkpoint or Shop
    public int Sector { get; set; } = 1;
    public int Difficulty { get; set; } = 1;
    public int Score { get; set; }
    public int Credits { get; set; }
    public int OwnedWeapons { get; set; } = 1;
    public int Lives { get; set; } = 3;
    public int WeaponLevel { get; set; } = 1;
    public int PrimaryMode { get; set; }
    public int Shield { get; set; }
    public int MaxShield { get; set; } = 3;
    public int Health { get; set; } = 4;
    public int MaxHull { get; set; } = 4;
    public int DroneUpgrade { get; set; }
    public int Magnet { get; set; }
    public int WeaponPowerLevel { get; set; }
    public int EngineLevel { get; set; }
    public int SectorRareCaches { get; set; }
    public int ShopRareCaches { get; set; }
    public string ShopRank { get; set; } = "C";
    public int ShopRankBonus { get; set; }
    public int SectorStartScore { get; set; }
    public int SectorCreditsEarned { get; set; }
    public int SectorCreditPickups { get; set; }
    public int SectorWeaponPickups { get; set; }
    public int SectorSupplyPickups { get; set; }
    public int SectorKills { get; set; }
    public bool FinalShop { get; set; }
    public int ShopScore { get; set; }
    public int ShopEarned { get; set; }
    public int ShopCreditPickups { get; set; }
    public int ShopWeaponPickups { get; set; }
    public int ShopSupplyPickups { get; set; }
    public int ShopKills { get; set; }
}

internal static class RunSaveStore
{
    internal static string SavePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "IronNebula", "run-save.json");
    private static readonly JsonSerializerOptions Options = new() { WriteIndented = true };

    internal static RunSaveData? Read()
    {
        foreach (var path in new[] { SavePath, SavePath + ".bak" })
        {
            try
            {
                if (!File.Exists(path)) continue;
                var state = JsonSerializer.Deserialize<RunSaveData>(File.ReadAllText(path));
                if (state == null || state.Schema != 1 ||
                    (state.Stage != "Checkpoint" && state.Stage != "Shop") ||
                    state.Sector is < 1 or > 3 ||
                    state.Difficulty is < 0 or > 2 ||
                    state.Score < 0 || state.Credits < 0 ||
                    state.Lives is < 1 or > 6 ||
                    state.MaxHull is < 4 or > 6 ||
                    state.MaxShield is < 3 or > 5 ||
                    state.WeaponLevel is < 1 or > 7 ||
                    state.PrimaryMode is < 0 or > 4 ||
                    state.OwnedWeapons is < 1 or > 31 ||
                    state.WeaponPowerLevel is < 0 or > 2 ||
                    state.EngineLevel is < 0 or > 2 ||
                    state.SectorRareCaches < 0 || state.ShopRareCaches < 0 ||
                    state.ShopRankBonus < 0) continue;
                return state;
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            catch (JsonException) { }
        }
        return null;
    }

    internal static bool Write(RunSaveData state)
    {
        string temp = SavePath + ".tmp";
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SavePath)!);
            File.WriteAllText(temp, JsonSerializer.Serialize(state, Options));
            if (File.Exists(SavePath)) File.Copy(SavePath, SavePath + ".bak", true);
            File.Move(temp, SavePath, true);
            return true;
        }
        catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch (IOException) { } }
    }

    internal static void Delete()
    {
        foreach (var path in new[] { SavePath, SavePath + ".bak", SavePath + ".tmp" })
            try { if (File.Exists(path)) File.Delete(path); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
    }
}