using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: pst — Private State Trees: private + verifiable.</summary>
    public sealed class PstSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
