import { FeatureDisabledNotice } from "../../components/ui/FeatureDisabledNotice";

export function PacksPage() {
  // Do not even prepare a mint (and incur rent) for a disabled paid mechanic.
  return <FeatureDisabledNotice id="packs" />;
}
