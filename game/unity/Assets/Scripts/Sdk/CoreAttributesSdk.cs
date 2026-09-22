using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: core-attributes — on-chain key-value (GrowthStage, Position), DAS 5ms.</summary>
    public sealed class CoreAttributesSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
