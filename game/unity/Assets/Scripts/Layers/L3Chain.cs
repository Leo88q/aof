using System;
namespace Aof.V3.Layers
{
    /// <summary>L3 Chain — SolanaClient, WalletAdapter, AnchorProgram, Candy Machine, SPL builders, session keys analog; programs AOF_CORE_PROGRAM_ID, CgInv111..., SessKeys111..., STrEaSuRy111....</summary>
    public sealed class L3Chain
    {
        public const string GameId = "aof";
        public void Boot() => Console.WriteLine("[L3Chain] " + GameId + " v3 ready");
    }
}
