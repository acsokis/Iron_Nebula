using System;
using System.IO;
using System.Text.Json;

namespace IronNebula;

internal static class ScoreStore
{
    private sealed class ScoreData { public int Best { get; set; } }

    private static string ScorePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "IronNebula", "scores.json");

    public static int ReadBest()
    {
        try
        {
            if (!File.Exists(ScorePath)) return 0;
            ScoreData? data=JsonSerializer.Deserialize<ScoreData>(File.ReadAllText(ScorePath));
            return Math.Max(0,data?.Best ?? 0);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return 0; // Corrupt or unavailable score file must never prevent the game launching.
        }
    }

    public static void WriteBest(int score)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ScorePath)!);
            File.WriteAllText(ScorePath,JsonSerializer.Serialize(new ScoreData{ Best=score }));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Game remains playable even without permission to write scores.
        }
    }
}