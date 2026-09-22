using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: preset — best free official scaffold (template farming), over create-solana-game.</summary>
    public sealed class PresetSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
