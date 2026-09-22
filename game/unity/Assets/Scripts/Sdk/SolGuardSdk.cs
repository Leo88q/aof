using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: solguard — 130+ checks, over SolShield.</summary>
    public sealed class SolGuardSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
