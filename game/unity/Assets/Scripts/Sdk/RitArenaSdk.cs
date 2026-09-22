using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: ritarena — crop tournaments, lifecycle retry events, over Aureus.</summary>
    public sealed class RitArenaSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
