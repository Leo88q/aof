using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: sentio-cli — tracing + anomaly pipelines.</summary>
    public sealed class SentioCliSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
