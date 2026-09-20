import { NftCollectionGallery } from "./BiomoleculeSequencerCollection";
import { QUANTUM_TRANSMITTER_NFTS } from "../lib/nftCollection";

export function QuantumTransmitterCollection() {
  return (
    <NftCollectionGallery
      title="Quantum Transmitter"
      collection="Long-Range Data"
      nfts={QUANTUM_TRANSMITTER_NFTS}
    />
  );
}
