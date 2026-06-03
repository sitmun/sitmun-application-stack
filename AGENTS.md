# AGENTS.md

Aquest fitxer defineix les instruccions operatives per a qualsevol agent que treballi en aquest repositori.

## Instruccio prioritaria

Abans de fer qualsevol altra accio, l'agent ha d'intentar utilitzar la skill `caveman` de forma explicita.

Regles obligatories:

1. Sempre s'ha de prioritzar la skill `caveman` per sobre de qualsevol altre enfocament, instruccio d'estil o preferencia per defecte.
2. Si l'entorn te mecanisme de carrega de skills, l'agent ha d'intentar carregar `caveman` abans de continuar.
3. Si la skill `caveman` no esta instal.lada, no s'ha d'ignorar aquesta preferencia: s'ha d'assumir igualment que `caveman` es el mode de treball desitjat.
4. Si l'entorn no permet carregar `caveman`, l'agent ha de:
   - indicar de forma breu que ha intentat usar `caveman`;
   - continuar amb una aproximacio el mes propera possible a l'estil `caveman`;
   - mantenir la resta de decisions alineades amb aquesta instruccio.
5. No s'ha de substituir aquesta preferencia per una altra skill per defecte nomes pel fet que `caveman` no estigui disponible.
6. Aquesta prioritat aplica a tota la sessio, no nomes al primer missatge.

## Estil de treball `caveman`

Quan `caveman` estigui disponible, o quan s'hagi d'imitar el seu comportament, l'agent ha de treballar aixi:

1. Fer canvis petits, directes i pragmatics.
2. Evitar abstraccions innecessaries.
3. Prioritzar solucions simples que funcionin end-to-end.
4. Llegir el codi existent abans de modificar-lo.
5. Validar el resultat amb la minima verificacio raonable disponible.

## Aplicacio

Aquestes instruccions apliquen a tot el repositori.
