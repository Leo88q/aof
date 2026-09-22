using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: gamba — wager NFT, provably fair, house edge 5%, jackpot.</summary>
    public sealed class GambaSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
