export interface ParsedLeadInput {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  estimatedConsumptionKwh?: number;
  estimatedConsumptionSmc?: number;
  notes?: string;
  source?: string;
}

export interface CsvParseResult {
  valid: ParsedLeadInput[];
  errors: string[];
  totalRows: number;
}

function detectDelimiter(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function parseLeadCsv(rawCsvText: string, defaultSource = 'Import CSV Marketing'): CsvParseResult {
  const result: CsvParseResult = {
    valid: [],
    errors: [],
    totalRows: 0,
  };

  if (!rawCsvText || !rawCsvText.trim()) {
    result.errors.push('Il file CSV è vuoto.');
    return result;
  }

  const lines = rawCsvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    result.errors.push('Il file deve contenere almeno una riga di intestazione e una riga di dati.');
    return result;
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = lines[0].split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  // Column index finders
  const nameIdx = normalizedHeaders.findIndex(h => 
    ['nome', 'cognome', 'nomecognome', 'nominativo', 'ragionesociale', 'cliente', 'name', 'fullname'].some(k => h.includes(k))
  );
  const phoneIdx = normalizedHeaders.findIndex(h => 
    ['telefono', 'cellulare', 'recapito', 'tel', 'phone', 'mobile', 'cell'].some(k => h.includes(k))
  );
  const emailIdx = normalizedHeaders.findIndex(h => 
    ['email', 'mail', 'posta'].some(k => h.includes(k))
  );
  const cityIdx = normalizedHeaders.findIndex(h => 
    ['citta', 'comune', 'provincia', 'cap', 'city', 'location'].some(k => h.includes(k))
  );
  const kwhIdx = normalizedHeaders.findIndex(h => 
    ['kwh', 'consumoluce', 'consumoelettrico', 'luce'].some(k => h.includes(k))
  );
  const smcIdx = normalizedHeaders.findIndex(h => 
    ['smc', 'consumogas', 'gas'].some(k => h.includes(k))
  );
  const notesIdx = normalizedHeaders.findIndex(h => 
    ['note', 'fonte', 'campagna', 'dettagli', 'notes', 'source'].some(k => h.includes(k))
  );

  if (nameIdx === -1) {
    result.errors.push('Colonna "Nome" non rilevata. Assicurati che il CSV contenga una colonna Nome o Cliente.');
    return result;
  }
  if (phoneIdx === -1) {
    result.errors.push('Colonna "Telefono" non rilevata. Assicurati che il CSV contenga una colonna Telefono o Cellulare.');
    return result;
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    result.totalRows++;
    const rowCells = lines[i].split(delimiter).map(cell => cell.replace(/^["']|["']$/g, '').trim());

    const name = rowCells[nameIdx];
    const phone = rowCells[phoneIdx];

    if (!name || name.length < 2) {
      result.errors.push(`Riga ${i + 1}: Nome mancante o troppo corto.`);
      continue;
    }
    if (!phone || phone.length < 6) {
      result.errors.push(`Riga ${i + 1}: Telefono mancante o non valido (${name}).`);
      continue;
    }

    const email = emailIdx !== -1 && rowCells[emailIdx] ? rowCells[emailIdx] : undefined;
    const city = cityIdx !== -1 && rowCells[cityIdx] ? rowCells[cityIdx] : 'Italia';
    
    let estimatedConsumptionKwh: number | undefined = undefined;
    if (kwhIdx !== -1 && rowCells[kwhIdx]) {
      const cleaned = rowCells[kwhIdx].replace(/[^0-9.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) estimatedConsumptionKwh = parsed;
    }

    let estimatedConsumptionSmc: number | undefined = undefined;
    if (smcIdx !== -1 && rowCells[smcIdx]) {
      const cleaned = rowCells[smcIdx].replace(/[^0-9.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) estimatedConsumptionSmc = parsed;
    }

    const customNotes = notesIdx !== -1 && rowCells[notesIdx] ? rowCells[notesIdx] : undefined;

    result.valid.push({
      name,
      phone,
      email,
      city,
      estimatedConsumptionKwh,
      estimatedConsumptionSmc,
      notes: customNotes,
      source: defaultSource,
    });
  }

  return result;
}
