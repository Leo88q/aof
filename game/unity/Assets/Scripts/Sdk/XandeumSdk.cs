using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: xandeum — exabyte storage, better than Arweave.</summary>
    public sealed class XandeumSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
