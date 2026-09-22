using System;
namespace Aof.V3.Layers
{
    /// <summary>L1 Platform — loop, config, Watchtower OS v3 client (gameId aof, stage/prototype).</summary>
    public sealed class L1Platform
    {
        public const string GameId = "aof";
        public void Boot() => Console.WriteLine("[L1Platform] " + GameId + " v3 ready");
    }
}
