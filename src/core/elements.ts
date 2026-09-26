/**
 * Standard atomic weights (g/mol).
 *
 * Source: IUPAC Commission on Isotopic Abundances and Atomic Weights (CIAAW),
 * standard atomic weights 2021. Elements whose standard atomic weight is an
 * interval (H, Li, B, C, N, O, Mg, Si, S, Cl, Ar, Br, Tl, Pb) use the IUPAC
 * conventional value, as chemical suppliers do.
 *
 * Elements with no stable isotopes and no standard atomic weight (Tc, Pm, Po,
 * ...) are deliberately absent: a formula weight for them depends on the
 * isotope and must come from the supplier.
 */

export interface Element {
  readonly symbol: string
  readonly name: string
  readonly atomicNumber: number
  /** Standard (or conventional) atomic weight in g/mol. */
  readonly weight: number
}

// [symbol, name, atomic number, atomic weight]
const DATA: readonly (readonly [string, string, number, number])[] = [
  ['H', 'hydrogen', 1, 1.008],
  ['He', 'helium', 2, 4.002602],
  ['Li', 'lithium', 3, 6.94],
  ['Be', 'beryllium', 4, 9.0121831],
  ['B', 'boron', 5, 10.81],
  ['C', 'carbon', 6, 12.011],
  ['N', 'nitrogen', 7, 14.007],
  ['O', 'oxygen', 8, 15.999],
  ['F', 'fluorine', 9, 18.998403162],
  ['Ne', 'neon', 10, 20.1797],
  ['Na', 'sodium', 11, 22.98976928],
  ['Mg', 'magnesium', 12, 24.305],
  ['Al', 'aluminium', 13, 26.9815384],
  ['Si', 'silicon', 14, 28.085],
  ['P', 'phosphorus', 15, 30.973761998],
  ['S', 'sulfur', 16, 32.06],
  ['Cl', 'chlorine', 17, 35.45],
  ['Ar', 'argon', 18, 39.95],
  ['K', 'potassium', 19, 39.0983],
  ['Ca', 'calcium', 20, 40.078],
  ['Sc', 'scandium', 21, 44.955907],
  ['Ti', 'titanium', 22, 47.867],
  ['V', 'vanadium', 23, 50.9415],
  ['Cr', 'chromium', 24, 51.9961],
  ['Mn', 'manganese', 25, 54.938043],
  ['Fe', 'iron', 26, 55.845],
  ['Co', 'cobalt', 27, 58.933194],
  ['Ni', 'nickel', 28, 58.6934],
  ['Cu', 'copper', 29, 63.546],
  ['Zn', 'zinc', 30, 65.38],
  ['Ga', 'gallium', 31, 69.723],
  ['Ge', 'germanium', 32, 72.63],
  ['As', 'arsenic', 33, 74.921595],
  ['Se', 'selenium', 34, 78.971],
  ['Br', 'bromine', 35, 79.904],
  ['Kr', 'krypton', 36, 83.798],
  ['Rb', 'rubidium', 37, 85.4678],
  ['Sr', 'strontium', 38, 87.62],
  ['Y', 'yttrium', 39, 88.905838],
  ['Zr', 'zirconium', 40, 91.224],
  ['Nb', 'niobium', 41, 92.90637],
  ['Mo', 'molybdenum', 42, 95.95],
  ['Ru', 'ruthenium', 44, 101.07],
  ['Rh', 'rhodium', 45, 102.90549],
  ['Pd', 'palladium', 46, 106.42],
  ['Ag', 'silver', 47, 107.8682],
  ['Cd', 'cadmium', 48, 112.414],
  ['In', 'indium', 49, 114.818],
  ['Sn', 'tin', 50, 118.71],
  ['Sb', 'antimony', 51, 121.76],
  ['Te', 'tellurium', 52, 127.6],
  ['I', 'iodine', 53, 126.90447],
  ['Xe', 'xenon', 54, 131.293],
  ['Cs', 'caesium', 55, 132.90545196],
  ['Ba', 'barium', 56, 137.327],
  ['La', 'lanthanum', 57, 138.90547],
  ['Ce', 'cerium', 58, 140.116],
  ['Pr', 'praseodymium', 59, 140.90766],
  ['Nd', 'neodymium', 60, 144.242],
  ['Sm', 'samarium', 62, 150.36],
  ['Eu', 'europium', 63, 151.964],
  ['Gd', 'gadolinium', 64, 157.25],
  ['Tb', 'terbium', 65, 158.925354],
  ['Dy', 'dysprosium', 66, 162.5],
  ['Ho', 'holmium', 67, 164.930329],
  ['Er', 'erbium', 68, 167.259],
  ['Tm', 'thulium', 69, 168.934219],
  ['Yb', 'ytterbium', 70, 173.045],
  ['Lu', 'lutetium', 71, 174.9668],
  ['Hf', 'hafnium', 72, 178.486],
  ['Ta', 'tantalum', 73, 180.94788],
  ['W', 'tungsten', 74, 183.84],
  ['Re', 'rhenium', 75, 186.207],
  ['Os', 'osmium', 76, 190.23],
  ['Ir', 'iridium', 77, 192.217],
  ['Pt', 'platinum', 78, 195.084],
  ['Au', 'gold', 79, 196.96657],
  ['Hg', 'mercury', 80, 200.592],
  ['Tl', 'thallium', 81, 204.38],
  ['Pb', 'lead', 82, 207.2],
  ['Bi', 'bismuth', 83, 208.9804],
  ['Th', 'thorium', 90, 232.0377],
  ['Pa', 'protactinium', 91, 231.03588],
  ['U', 'uranium', 92, 238.02891],
  // Deuterium, for deuterated solvents such as D2O and CDCl3 (atomic mass of 2H).
  ['D', 'deuterium', 1, 2.01410177812],
]

export const ELEMENTS: ReadonlyMap<string, Element> = new Map(
  DATA.map(([symbol, name, atomicNumber, weight]) => [
    symbol,
    { symbol, name, atomicNumber, weight },
  ]),
)

/** Real elements that have no standard atomic weight (no stable isotopes). */
// prettier-ignore
export const NO_STANDARD_WEIGHT: ReadonlySet<string> = new Set([
  'Tc', 'Pm', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Np', 'Pu', 'Am', 'Cm',
  'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs',
  'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
])
