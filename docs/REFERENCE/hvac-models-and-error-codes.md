# REFERENCE: HVAC Models & Error Codes — Brasil 2026

> **Source:** Buscapé (Abril 2026) + Coolfix GitHub + hvac-troubleshoot-pro
> **Status:** READ-ONLY Reference Data
> **Usage:** Qdrant payload metadata, whitelist validation, RAG queries

---

## 1. Modelos Inverter Brasil (416+ SKUs)

### Springer/Midea
| Modelo | Código | BTU | Tipo | Refrigerante |
|--------|--------|-----|------|--------------|
| AI Ecomaster | 42EZVCA12M5/38EZVCA12M5 | 12k | Split | R-32 |
| AI Ecomaster | 42EZVCA09M5/38EZVCA09M5 | 9k | Split | R-32 |
| AI Ecomaster | 42EZVCA24M5/38EZVCA24M5 | 24k | Split | R-32 |
| AirVolution Connect | 42AFVCI12M8/38AFVCI12M8 | 12k | Split | R-32 |
| Xtreme Save Connect | 42AGVCI12M5/38AGVCI12M5 | 12k | Split | R-32 |
| Xtreme Save Connect Black | 42MGVQI12M5/38MGVQI12M5 | 12k | Split | R-32 |
| Xtreme Save Connect | 42AGVQI18M5/38AGVQI18M5 | 18k | Split | R-32 |

### LG
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| Dual Inverter Compact | S3-Q12JAQAL | 12k | Split |
| Dual Inverter Compact | S3-Q09AAQAK | 9k | Split |
| Dual Inverter Voice | S3-W12JA31A | 12k | Split |
| Dual Inverter Voice | S3-Q24K231B | 24k | Split |
| AI Dual Inverter Voice | S3-Q12JA31L | 12k | Split |
| Dual Inverter Voice Artcool | S3-W12JAR7A | 12k | Split |
| LP1419IVSI (Portátil) | - | 14k | Portátil |

### Samsung
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| Wind-Free | AR12DYFAAWKNAZ | 12k | Split |
| Wind-Free Connect | AR09DYFAAWKNAZ | 9k | Split |
| Wind-Free | AR18CVFAAWKNAZ | 18k | Split |
| Digital Inverter | AR12CVHZAWK | 12k | Split |
| Split Piso/Teto | F-CAC-024DN4DK | 24k | Piso/Teto |
| Split Cassete | F-CAC-036DN4DK | 36k | Cassette |

### Daikin
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| FTKC12T5VL/RKC12T5VL | - | 12k | Split |
| FTKP09Q5VL/RKP09Q5VL | - | 9k | Split EcoSwing |
| FCQ48AVL/RZQ48AVL | - | 48k | Cassette |
| FBQ36AVL/RZQ36AVL | - | 36k | Duto |

### Consul
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| CCK07BB | - | 7k | Janela |
| CBK09D/CBL09D | - | 9k | Split |
| CBR12C/SBS12C | - | 12k | Split |
| CBK18CB | - | 18k | Split |

### Electrolux
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| YI12F/YE12F | - | 12k | Split |
| YI18R/YE18R | - | 18k | Split |
| JI24F/JE24F | - | 24k | Split |
| KI36F/KE36F | - | 36k | Cassette |
| DI36F/DE36F | - | 36k | Piso/Teto |

### Philco
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| PAC9FC | - | 9k | Split |
| PAC12FC | - | 12k | Split |
| PAC18FC | - | 18k | Split |
| PAC24FC | - | 24k | Split |
| PAC36000ICFM16 | - | 36k | Cassette |
| PAC60000IPFM5 | - | 55k | Piso/Teto |

### Gree
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| G-Top Auto | GWC12ATC-D6DNA1A | 12k | Split |
| G-Top Auto | GWC09ATA-D6DNA1A | 9k | Split |

### Elgin
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| Eco II | HJFI12C2WB/HJFE12C2CB | 12k | Split |
| Eco Star | HSFE18C2N | 18k | Split |
| Eco II | HJFE30C2CB/HJFI30C2WB | 30k | Split |

---

## 2. Códigos de Erro — Universal (Todas as Marcas)

| Code | Description | User Fixable? | Brand agnostic |
|-------|-------------|---------------|----------------|
| E0 | Sem erro / Normal | - | Yes |
| E1 | Erro de comunicação | Possible | Yes |
| E2 | Erro de temperatura / sensor | No | Yes |
| E3 | Erro sensor condensador | No | Yes |
| E4 | Erro refrigerante/pressão | No | Yes |
| E5 | Superaquecimento compressor | Possible | Yes |
| E6 | Erro comunicação indoor/outdoor | Possible | Yes |
| E7 | Sobrecorrente | No | Yes |
| E8 | Anomalia tensão / Proteção IPM | Possible | Yes |
| F0 | Baixo refrigerante | No | Yes |
| F1 | Erro motor ventilador interno | Possible | Yes |
| F3 | Erro motor ventilador externo | Possible | Yes |
| F6 | Erro sensor coil | No | Yes |
| P0 | Falha drive compressor | No | Yes |

---

## 3. Códigos de Erro — Por Marca

### LG Inverter
CH01, CH02, CH06, CH08, CH10, CH11, CH29, CH57, CH59, CH99

### Samsung Inverter
E101, E121, E126, E128, E129, E154, E201, E261, E306, E401

### Daikin Inverter
A1, A5, A6, C1, C4, C28, C30, C35, C36, C59

### Midea/Springer/Consul
E01-E16, F01-F45

---

## 4. Dados de Mercado

- **416+** resultados Inverter no Buscapé (Abril 2026)
- **12+** marcas principais
- **Faixa de preço:** R$ 1.529,90 (HQ 9k) a R$ 12.299,40 (Samsung 54k)
- **Capacidades:** 7k, 9k, 12k, 18k, 22k, 24k, 30k, 36k, 48k, 54k, 55k BTUs

---

## 5. Fontes

| Fonte | Tipo | URL |
|-------|------|-----|
| Coolfix GitHub | errorCodes.json | github.com/hysenmuhamad/coolfix |
| hvac-troubleshoot-pro | 18-table schema | github.com/Huskyauto/hvac-troubleshoot-pro |
| Buscapé | Model data | buscape.com.br |

---

*Este arquivo é gerado automaticamente. Não editar manualmente.*
