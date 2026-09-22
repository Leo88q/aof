using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: solana-slam — SLAM LiteSVM harness.</summary>
    public sealed class SolanaSlamSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
