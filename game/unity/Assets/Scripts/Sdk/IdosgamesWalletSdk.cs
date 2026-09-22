using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: idosgames-wallet — EVM<->Solana bridge + RewardPool.</summary>
    public sealed class IdosgamesWalletSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
