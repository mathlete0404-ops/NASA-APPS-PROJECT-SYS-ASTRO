// Evidence chips: every card links to the NASA data or peer-reviewed source behind it.
import osdr from '../generated/osdr_baseline_evidence.json'

export interface Evidence { id: string; label: string; url: string; kind: 'nasa-data' | 'nasa' | 'paper' }

export const EVIDENCE: Record<string, Evidence> = {
  osd569: { id: 'osd569', kind: 'nasa-data', label: 'OSDR OSD-569 · Inspiration4 blood count', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-569' },
  osd575: { id: 'osd575', kind: 'nasa-data', label: 'OSDR OSD-575 · Inspiration4 metabolic panel', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575' },
  radlab: { id: 'radlab', kind: 'nasa-data', label: 'RadLab Portal · space radiation', url: 'https://visualization.osdr.nasa.gov/radlab/gui/overview/' },
  swpc: { id: 'swpc', kind: 'paper', label: 'NOAA SWPC · space weather scales and GOES proton flux', url: 'https://www.swpc.noaa.gov/noaa-scales-explanation' },
  eda: { id: 'eda', kind: 'nasa-data', label: 'OSDR Environmental Data App · cabin CO₂', url: 'https://visualization.osdr.nasa.gov/eda/' },
  nlsp: { id: 'nlsp', kind: 'nasa-data', label: 'NASA Life Sciences Portal (data.nasa.gov)', url: 'https://data.nasa.gov/dataset/nasa-life-sciences-portal-nlsp' },
  spine: { id: 'spine', kind: 'nasa', label: 'NASA · Astronauts’ spines under scrutiny', url: 'https://www.nasa.gov/feature/astronauts-spines-under-scrutiny' },
  paraspinal: { id: 'paraspinal', kind: 'paper', label: 'Chang et al. · paraspinal muscle loss in ISS crew', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5588025' },
  walkline: { id: 'walkline', kind: 'nasa', label: 'NASA · Walk the line (post-flight balance)', url: 'https://www.nasa.gov/?p=268780' },
  fieldtest: { id: 'fieldtest', kind: 'nasa', label: 'NASA NTRS · Field Test tandem walk', url: 'https://ntrs.nasa.gov/api/citations/20160013636/downloads/20160013636.pdf' },
  mass: { id: 'mass', kind: 'paper', label: 'Body mass change in long-duration flight', url: 'https://www.ncbi.nlm.nih.gov/pubmed/25197887' },
  nutrition: { id: 'nutrition', kind: 'nasa', label: 'NASA NTRS · space nutrition and bone', url: 'https://ntrs.nasa.gov/citations/20080026254' },
  osdr: { id: 'osdr', kind: 'nasa', label: 'NASA NTRS · OSDR overview', url: 'https://ntrs.nasa.gov/citations/20230015800' },
  pos: { id: 'pos', kind: 'paper', label: 'Wang et al. 2017 · POS remote PPG method', url: 'https://doi.org/10.1109/TBME.2016.2609282' },
}

export const OSDR_EVIDENCE = osdr
export type OsdrAnalyte = (typeof osdr.analytes)[number]
