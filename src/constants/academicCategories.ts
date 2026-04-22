// Arxiv 学术领域分类
// 一级领域作为 key，二级领域作为 value 数组
export const ACADEMIC_CATEGORIES: Record<string, { name: string; code: string }[]> = {
  "Computer Science": [
    { "name": "Artificial Intelligence", "code": "cs.AI" },
    { "name": "Hardware Architecture", "code": "cs.AR" },
    { "name": "Computational Complexity", "code": "cs.CC" },
    { "name": "Computational Engineering, Finance, and Science", "code": "cs.CE" },
    { "name": "Computational Geometry", "code": "cs.CG" },
    { "name": "Computation and Language", "code": "cs.CL" },
    { "name": "Cryptography and Security", "code": "cs.CR" },
    { "name": "Computer Vision and Pattern Recognition", "code": "cs.CV" },
    { "name": "Computers and Society", "code": "cs.CY" },
    { "name": "Databases", "code": "cs.DB" },
    { "name": "Distributed, Parallel, and Cluster Computing", "code": "cs.DC" },
    { "name": "Digital Libraries", "code": "cs.DL" },
    { "name": "Discrete Mathematics", "code": "cs.DM" },
    { "name": "Data Structures and Algorithms", "code": "cs.DS" },
    { "name": "Emerging Technologies", "code": "cs.ET" },
    { "name": "Formal Languages and Automata Theory", "code": "cs.FL" },
    { "name": "General Literature", "code": "cs.GL" },
    { "name": "Graphics", "code": "cs.GR" },
    { "name": "Computer Science and Game Theory", "code": "cs.GT" },
    { "name": "Human-Computer Interaction", "code": "cs.HC" },
    { "name": "Information Retrieval", "code": "cs.IR" },
    { "name": "Information Theory", "code": "cs.IT" },
    { "name": "Machine Learning", "code": "cs.LG" },
    { "name": "Logic in Computer Science", "code": "cs.LO" },
    { "name": "Multiagent Systems", "code": "cs.MA" },
    { "name": "Multimedia", "code": "cs.MM" },
    { "name": "Mathematical Software", "code": "cs.MS" },
    { "name": "Numerical Analysis", "code": "cs.NA" },
    { "name": "Neural and Evolutionary Computing", "code": "cs.NE" },
    { "name": "Networking and Internet Architecture", "code": "cs.NI" },
    { "name": "Other Computer Science", "code": "cs.OH" },
    { "name": "Operating Systems", "code": "cs.OS" },
    { "name": "Performance", "code": "cs.PF" },
    { "name": "Programming Languages", "code": "cs.PL" },
    { "name": "Robotics", "code": "cs.RO" },
    { "name": "Symbolic Computation", "code": "cs.SC" },
    { "name": "Sound", "code": "cs.SD" },
    { "name": "Software Engineering", "code": "cs.SE" },
    { "name": "Social and Information Networks", "code": "cs.SI" },
    { "name": "Systems and Control", "code": "cs.SY" }
  ],
  "Economics": [
    { "name": "Econometrics", "code": "econ.EM" },
    { "name": "General Economics", "code": "econ.GN" },
    { "name": "Theoretical Economics", "code": "econ.TH" }
  ],
  "Electrical Engineering and Systems Science": [
    { "name": "Audio and Speech Processing", "code": "eess.AS" },
    { "name": "Image and Video Processing", "code": "eess.IV" },
    { "name": "Signal Processing", "code": "eess.SP" },
    { "name": "Systems and Control", "code": "eess.SY" }
  ],
  "Mathematics": [
    { "name": "Commutative Algebra", "code": "math.AC" },
    { "name": "Algebraic Geometry", "code": "math.AG" },
    { "name": "Analysis of PDEs", "code": "math.AP" },
    { "name": "Algebraic Topology", "code": "math.AT" },
    { "name": "Classical Analysis and ODEs", "code": "math.CA" },
    { "name": "Combinatorics", "code": "math.CO" },
    { "name": "Category Theory", "code": "math.CT" },
    { "name": "Complex Variables", "code": "math.CV" },
    { "name": "Differential Geometry", "code": "math.DG" },
    { "name": "Dynamical Systems", "code": "math.DS" },
    { "name": "Functional Analysis", "code": "math.FA" },
    { "name": "General Mathematics", "code": "math.GM" },
    { "name": "General Topology", "code": "math.GN" },
    { "name": "Group Theory", "code": "math.GR" },
    { "name": "Geometric Topology", "code": "math.GT" },
    { "name": "History and Overview", "code": "math.HO" },
    { "name": "Information Theory", "code": "math.IT" },
    { "name": "K-Theory and Homology", "code": "math.KT" },
    { "name": "Logic", "code": "math.LO" },
    { "name": "Metric Geometry", "code": "math.MG" },
    { "name": "Mathematical Physics", "code": "math.MP" },
    { "name": "Numerical Analysis", "code": "math.NA" },
    { "name": "Number Theory", "code": "math.NT" },
    { "name": "Operator Algebras", "code": "math.OA" },
    { "name": "Optimization and Control", "code": "math.OC" },
    { "name": "Probability", "code": "math.PR" },
    { "name": "Quantum Algebra", "code": "math.QA" },
    { "name": "Rings and Algebras", "code": "math.RA" },
    { "name": "Representation Theory", "code": "math.RT" },
    { "name": "Symplectic Geometry", "code": "math.SG" },
    { "name": "Spectral Theory", "code": "math.SP" },
    { "name": "Statistics Theory", "code": "math.ST" }
  ],
  "Astrophysics": [
    { "name": "Cosmology and Nongalactic Astrophysics", "code": "astro-ph.CO" },
    { "name": "Earth and Planetary Astrophysics", "code": "astro-ph.EP" },
    { "name": "Astrophysics of Galaxies", "code": "astro-ph.GA" },
    { "name": "High Energy Astrophysical Phenomena", "code": "astro-ph.HE" },
    { "name": "Instrumentation and Methods for Astrophysics", "code": "astro-ph.IM" },
    { "name": "Solar and Stellar Astrophysics", "code": "astro-ph.SR" }
  ],
  "Condensed Matter": [
    { "name": "Disordered Systems and Neural Networks", "code": "cond-mat.dis-nn" },
    { "name": "Mesoscale and Nanoscale Physics", "code": "cond-mat.mes-hall" },
    { "name": "Materials Science", "code": "cond-mat.mtrl-sci" },
    { "name": "Other Condensed Matter", "code": "cond-mat.other" },
    { "name": "Quantum Gases", "code": "cond-mat.quant-gas" },
    { "name": "Soft Condensed Matter", "code": "cond-mat.soft" },
    { "name": "Statistical Mechanics", "code": "cond-mat.stat-mech" },
    { "name": "Strongly Correlated Electrons", "code": "cond-mat.str-el" },
    { "name": "Superconductivity", "code": "cond-mat.supr-con" }
  ],
  "General Relativity and Quantum Cosmology": [
    { "name": "General Relativity and Quantum Cosmology", "code": "gr-qc" }
  ],
  "High Energy Physics": [
    { "name": "High Energy Physics - Experiment", "code": "hep-ex" },
    { "name": "High Energy Physics - Lattice", "code": "hep-lat" },
    { "name": "High Energy Physics - Phenomenology", "code": "hep-ph" },
    { "name": "High Energy Physics - Theory", "code": "hep-th" }
  ],
  "Mathematical Physics": [
    { "name": "Mathematical Physics", "code": "math-ph" }
  ],
  "Nonlinear Sciences": [
    { "name": "Adaptation and Self-Organizing Systems", "code": "nlin.AO" },
    { "name": "Chaotic Dynamics", "code": "nlin.CD" },
    { "name": "Cellular Automata and Lattice Gases", "code": "nlin.CG" },
    { "name": "Pattern Formation and Solitons", "code": "nlin.PS" },
    { "name": "Exactly Solvable and Integrable Systems", "code": "nlin.SI" }
  ],
  "Nuclear Physics": [
    { "name": "Nuclear Experiment", "code": "nucl-ex" },
    { "name": "Nuclear Theory", "code": "nucl-th" }
  ],
  "Physics": [
    { "name": "Accelerator Physics", "code": "physics.acc-ph" },
    { "name": "Atmospheric and Oceanic Physics", "code": "physics.ao-ph" },
    { "name": "Applied Physics", "code": "physics.app-ph" },
    { "name": "Atomic and Molecular Clusters", "code": "physics.atm-clus" },
    { "name": "Atomic Physics", "code": "physics.atom-ph" },
    { "name": "Biological Physics", "code": "physics.bio-ph" },
    { "name": "Chemical Physics", "code": "physics.chem-ph" },
    { "name": "Classical Physics", "code": "physics.class-ph" },
    { "name": "Computational Physics", "code": "physics.comp-ph" },
    { "name": "Data Analysis, Statistics and Probability", "code": "physics.data-an" },
    { "name": "Physics Education", "code": "physics.ed-ph" },
    { "name": "Fluid Dynamics", "code": "physics.flu-dyn" },
    { "name": "General Physics", "code": "physics.gen-ph" },
    { "name": "Geophysics", "code": "physics.geo-ph" },
    { "name": "History and Philosophy of Physics", "code": "physics.hist-ph" },
    { "name": "Instrumentation and Detectors", "code": "physics.ins-det" },
    { "name": "Medical Physics", "code": "physics.med-ph" },
    { "name": "Optics", "code": "physics.optics" },
    { "name": "Plasma Physics", "code": "physics.plasm-ph" },
    { "name": "Popular Physics", "code": "physics.pop-ph" },
    { "name": "Physics and Society", "code": "physics.soc-ph" },
    { "name": "Space Physics", "code": "physics.space-ph" }
  ],
  "Quantum Physics": [
    { "name": "Quantum Physics", "code": "quant-ph" }
  ],
  "Quantitative Biology": [
    { "name": "Biomolecules", "code": "q-bio.BM" },
    { "name": "Cell Behavior", "code": "q-bio.CB" },
    { "name": "Genomics", "code": "q-bio.GN" },
    { "name": "Molecular Networks", "code": "q-bio.MN" },
    { "name": "Neurons and Cognition", "code": "q-bio.NC" },
    { "name": "Other Quantitative Biology", "code": "q-bio.OT" },
    { "name": "Populations and Evolution", "code": "q-bio.PE" },
    { "name": "Quantitative Methods", "code": "q-bio.QM" },
    { "name": "Subcellular Processes", "code": "q-bio.SC" },
    { "name": "Tissues and Organs", "code": "q-bio.TO" }
  ],
  "Quantitative Finance": [
    { "name": "Computational Finance", "code": "q-fin.CP" },
    { "name": "Economics", "code": "q-fin.EC" },
    { "name": "General Finance", "code": "q-fin.GN" },
    { "name": "Mathematical Finance", "code": "q-fin.MF" },
    { "name": "Portfolio Management", "code": "q-fin.PM" },
    { "name": "Pricing of Securities", "code": "q-fin.PR" },
    { "name": "Risk Management", "code": "q-fin.RM" },
    { "name": "Statistical Finance", "code": "q-fin.ST" },
    { "name": "Trading and Market Microstructure", "code": "q-fin.TR" }
  ],
  "Statistics": [
    { "name": "Applications", "code": "stat.AP" },
    { "name": "Computation", "code": "stat.CO" },
    { "name": "Methodology", "code": "stat.ME" },
    { "name": "Machine Learning", "code": "stat.ML" },
    { "name": "Other Statistics", "code": "stat.OT" },
    { "name": "Statistics Theory", "code": "stat.TH" }
  ]
};

// 获取所有二级领域的扁平列表
export const getAllCategories = (): { name: string; code: string; parent: string }[] => {
  const result: { name: string; code: string; parent: string }[] = [];
  Object.entries(ACADEMIC_CATEGORIES).forEach(([parent, categories]) => {
    categories.forEach(cat => {
      result.push({ ...cat, parent });
    });
  });
  return result;
};

// 根据代码获取领域信息
export const getCategoryByCode = (code: string): { name: string; code: string; parent: string } | undefined => {
  for (const [parent, categories] of Object.entries(ACADEMIC_CATEGORIES)) {
    const found = categories.find(cat => cat.code === code);
    if (found) {
      return { ...found, parent };
    }
  }
  return undefined;
};
