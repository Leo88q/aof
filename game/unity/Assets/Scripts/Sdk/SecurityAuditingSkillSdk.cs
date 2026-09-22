using System.Collections.Generic;
namespace Aof.V3.Sdk
{
    /// <summary>v3 SDK: security-auditing-skill — systematic audit Claude Skill.</summary>
    public sealed class SecurityAuditingSkillSdk
    {
        public Dictionary<string, object> Config() =>
            new Dictionary<string, object> { ["gameId"] = "aof", ["tier"] = "ideal-free" };
    }
}
