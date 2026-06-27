# Tormenta 20 — Plugin para Owlbear Rodeo

Fichas de **Personagem** e **Ameaça** de Tormenta 20 integradas ao Owlbear Rodeo.

---

## 📁 Estrutura de arquivos

```
tormenta20-obr/
├── manifest.json          ← Ponto de entrada do plugin
├── icon.svg               ← Ícone do plugin
├── css/
│   └── style.css          ← Estilos compartilhados
├── js/
│   └── t20.js             ← Utilitários e comunicação com OBR SDK
└── pages/
    ├── painel.html        ← Painel principal (lista de fichas)
    ├── ficha-personagem.html  ← Ficha de personagem completa
    └── ficha-ameaca.html  ← Ficha de ameaça / monstro
```

## ✨ Como usar

### Criar uma ficha
1. Clique no ícone **T20** no mapa → abre o **Painel**.
2. Clique em **"Nova Ficha de Personagem"** ou **"Nova Ficha de Ameaça"**.
3. A ficha abre num modal. Preencha os campos — **salva automaticamente**.

### Gerenciar fichas
- Todas as fichas criadas aparecem no Painel.
- Clique em qualquer ficha para abri-la novamente.
- Clique em **✕** para excluir.
- As fichas são compartilhadas com **todos na sala** em tempo real.

---

## 🛠 Ficha de Personagem — o que tem

- **Identidade**: Nome, Jogador, Nível, Raça, Origem, Classe, Divindade
- **Atributos**: FOR, DES, CON, INT, SAB, CAR com modificadores automáticos
- **Defesa**: Calculada automaticamente (10 + mod DES + armadura + escudo + outros)
- **PV e PM**: Barras visuais de progresso
- **Armadura & Escudo**: Linhas editáveis com bônus e penalidade
- **Ataques**: Tabela com Teste, Dano, Crítico, Tipo, Alcance
- **Perícias**: Lista completa T20 com treino, cálculo automático e penalidade de armadura
- **Habilidades & Magias**: Campos livres em duas colunas
- **Proficiências, Equipamento, Tesouro, Notas**

## 🛠 Ficha de Ameaça — o que tem

- **Nome, Tipo, Tamanho** e **ND** em destaque
- **Iniciativa, Percepção** e sentidos especiais
- **Defesa, Fortitude, Reflexos, Vontade**
- **Resistências, imunidades, vulnerabilidades**
- **PV** com barra visual + PM + Deslocamento
- **Ataques** corpo a corpo e à distância (com campos extras)
- **Atributos** com modificadores automáticos
- **Perícias** (lista customizável)
- **Habilidades Especiais** com tipo e descrição
- **Equipamentos, Tesouro, Táticas & Notas**

---

## 📝 Notas técnicas

- Os dados são salvos no **metadata da sala** do OBR (limite de 16kB por sala).
- Para campanhas com muitas fichas e muitas habilidades, considere limpar fichas antigas.
- O plugin funciona em qualquer navegador moderno.
- Testado com manifest_version 1 (SDK @owlbear-rodeo/sdk@1.10.0).

---

*Plugin criado com ❤️ para Tormenta 20 — Jogo do Ano*
