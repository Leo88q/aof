using System;
namespace Aof.V3.Layers
{
    /// <summary>L2 Identity — Privy guest/embedded wallet + gas sponsorship, Phantom FirstStep, Altude, Session Keys (createSession AOF_CORE_PROGRAM_ID, topUp 0.01 SOL, expiry 60 min).</summary>
    public sealed class L2Identity
    {
        public const string GameId = "aof";
        public void Boot() => Console.WriteLine("[L2Identity] " + GameId + " v3 ready");
    }
}
