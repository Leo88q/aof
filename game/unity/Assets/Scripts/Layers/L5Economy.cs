using System;
namespace Aof.V3.Layers
{
    /// <summary>L5 Economy — farming, crafting, trading, marketplace loops; Gamba craft gamble (house edge 5%, jackpot).</summary>
    public sealed class L5Economy
    {
        public const string GameId = "aof";
        public void Boot() => Console.WriteLine("[L5Economy] " + GameId + " v3 ready");
    }
}
