using System;
namespace Aof.V3.Layers
{
    /// <summary>L6 Data — LaserStream gRPC, Shyft gPA 15ms + TOKEN_MINT/NFT_MINT callbacks, PG+Timescale+Redis (idempotency, gap backfill, finalized reconciliation).</summary>
    public sealed class L6Data
    {
        public const string GameId = "aof";
        public void Boot() => Console.WriteLine("[L6Data] " + GameId + " v3 ready");
    }
}
