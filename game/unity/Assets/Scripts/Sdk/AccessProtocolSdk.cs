using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: access-protocol — stake-to-access rare crops, golden tools, land.</summary>
    public sealed class AccessProtocolSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
