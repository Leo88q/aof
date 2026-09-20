import { NftCollectionGallery } from "./BiomoleculeSequencerCollection";
import { ROBOTIC_HARVEST_ARM_NFTS } from "../lib/nftCollection";

export function RoboticHarvestArmCollection() {
  return (
    <NftCollectionGallery
      title="Robotic Harvest Arm"
      collection="Automated Collector"
      nfts={ROBOTIC_HARVEST_ARM_NFTS}
    />
  );
}
