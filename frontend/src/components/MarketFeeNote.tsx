import { useLocale } from "../i18n/LocaleProvider";
import { chainMomentCopy } from "../i18n/chainMomentCopy";

export function MarketFeeNote() {
  const { language } = useLocale();
  return <p className="text-straw text-xs break-words">{chainMomentCopy[language].marketFee}</p>;
}
