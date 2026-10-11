import { getAddress, type Address } from 'viem';

/**
 * A static sample of addresses OFAC added to the SDN list on 8 August 2022
 * (the Tornado Cash designation — https://ofac.treasury.gov/recent-actions/20220808,
 * which listed 38 Ethereum addresses). This is a demo-scale snapshot of real,
 * published sanctions data, not a live feed: a production deployment would
 * screen against OFAC's full, continuously updated list (or a provider like
 * Chainalysis), not a hardcoded subset frozen at hackathon time.
 */
const SANCTIONED_ADDRESSES: Address[] = (
  [
    '0x8589427373D6D84E98730D7795D8f6f8731FDA16',
    '0x722122dF12D4e14e13Ac3b6895a86e84145b6967',
    '0xDD4c48C0B24039969fC16D1cdF626eaB821d3384',
    '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b',
    '0x07687e702b410Fa43f4cB4Af7FA097918ffD2730',
    '0x94A1B5CdB22c43faab4AbEb5c74999895464Ddaf',
    '0x23773E65ed146A459791799d01336DB287f25334',
    '0x178169B423a011fff22B9e3F3abeA13414dDD0F1',
    '0x610B717796ad172B316836AC95a2ffad065CeaB4',
    '0xbB93e510BbCD0B7beb5A853875f9eC60275CF498',
  ] as const
).map((a) => getAddress(a));

const SANCTIONED_SET = new Set(SANCTIONED_ADDRESSES.map((a) => a.toLowerCase()));

export const SANCTIONS_SOURCE_LABEL = 'OFAC SDN list — Tornado Cash designation, 8 Aug 2022 (static sample)';

export function isSanctioned(address: Address): boolean {
  return SANCTIONED_SET.has(address.toLowerCase());
}

/** One real sanctioned address, exposed so the demo dApp can deliberately trigger the block. */
export const SAMPLE_SANCTIONED_ADDRESS = SANCTIONED_ADDRESSES[0]!;
