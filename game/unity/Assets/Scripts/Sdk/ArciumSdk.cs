using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: arcium — confidential compute.</summary>
    public sealed class ArciumSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
