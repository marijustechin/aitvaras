# Receiving inventory — BEFORE redesign

> Status: **audit / documentation only**. Baseline captured 2026-11-19 on the
> uncommitted receiving work (ATV-066…074). Application code, schema and live
> records were not changed. Method for repeating this inventory:
> [receiving-inventory-method.md](receiving-inventory-method.md).

## 1. How to read this document

- §2 is the reproducible baseline.
- §3 is the route map and §4 the role/scenario walk (UI inward).
- §5 is the capability inventory, one row per behaviour/calculation. IDs are
  stable and survive renames (`RCV-<AREA>-<NN>`); `↔` links rows of one journey.
- §6 is the API surface from the source tree (code outward), including endpoints
  with no web caller.
- §7 records data effects, §8 the calculation register, §9 the findings with
  evidence, §10 the dependencies needed to read history.
- Anything not exercised live is marked as such; see §2.4.

## 2. Baseline

### 2.1 Version identity

| Item | Value |
|---|---|
| Repository | `aitvaras` (own Git repo) |
| Branch | `main` |
| HEAD | `7b4066857b9438f31413f8319460964cef8b82de` |
| Baseline date | 2026-11-19 |
| Node/npm | Node >= 22.18.0, `npm@12.2.2` (root `package.json`) |

**The commit hash alone does not identify this version** — the receiving changes
are uncommitted in the working tree.

### 2.2 Working tree at capture

`git status --porcelain=v1` (verbatim at capture, 68 entries: 39 modified,
29 untracked):

```text
 M AGENTS.md
 M TODO.md
 M apps/api/src/modules/batches/batch.mapper.ts
 M apps/api/src/modules/batches/batches.controller.ts
 M apps/api/src/modules/batches/batches.service.ts
 M apps/api/src/modules/batches/deliveries.controller.ts
 M apps/api/src/modules/stock/stock-summary.test.ts
 M apps/api/src/modules/stock/stock-summary.ts
 M apps/api/src/modules/stock/stock.service.ts
 M apps/api/test/batches.e2e.test.ts
 M apps/api/test/piece-batches.e2e.test.ts
 M apps/web/src/app/receipts/batches/[id]/page.tsx
 M apps/web/src/app/receiving/new/page.tsx
 M apps/web/src/app/receiving/page.tsx
 M apps/web/src/features/manage-batches/index.ts
 M apps/web/src/features/manage-batches/lib/batch-form.test.ts
 M apps/web/src/features/manage-batches/lib/batch-form.ts
 M apps/web/src/features/manage-batches/lib/batch-list.test.ts
 M apps/web/src/features/manage-batches/lib/batch-list.ts
 M apps/web/src/features/manage-batches/lib/receiving.test.ts
 M apps/web/src/features/manage-batches/lib/receiving.ts
 M apps/web/src/features/manage-batches/ui/batch-details-page.tsx
 M apps/web/src/features/manage-batches/ui/gavimai-page.tsx
 M apps/web/src/features/manage-batches/ui/receiving-delivery.tsx
 M apps/web/src/features/manage-batches/ui/receiving-page.tsx
 M docs/authorization.md
 M docs/batches.md
 M docs/discrepancies.md
 M docs/domain-glossary.md
 M docs/frontend-architecture.md
 M docs/piece-batches.md
 M docs/receipts.md
 M docs/scope.md
 M docs/stock-summary.md
 M packages/contracts/src/batches.ts
 M packages/contracts/src/incoming-deliveries.test.ts
 M packages/contracts/src/incoming-deliveries.ts
 M packages/contracts/src/index.ts
 M packages/database/prisma/schema.prisma
?? apps/api/src/modules/batches/batch-redaction.ts
?? apps/api/src/modules/batches/expense-allocation.test.ts
?? apps/api/src/modules/batches/expense-allocation.ts
?? apps/api/test/delivery-expenses.e2e.test.ts
?? apps/web/src/app/receipts/[deliveryId]/
?? apps/web/src/features/manage-batches/ui/delivery-expenses.tsx
?? apps/web/src/features/manage-batches/ui/product-combobox.tsx
?? apps/web/src/features/manage-batches/ui/receipt-manager-page.tsx
?? docs/screenshots/atv-066/
?? docs/screenshots/atv-067/
?? docs/screenshots/atv-068/
?? docs/screenshots/atv-069/
?? docs/screenshots/atv-070/
?? docs/screenshots/atv-071/
?? docs/screenshots/atv-072/
?? docs/screenshots/atv-073/
?? docs/screenshots/atv-074/
?? packages/contracts/src/delivery-expenses.ts
?? packages/database/prisma/migrations/20261118160000_delivery_expenses/
?? packages/database/prisma/migrations/20261118180000_expense_application_ledger/
?? tasks/done/ATV-066-compact-gautos-partijos-filters.md
?? tasks/done/ATV-067-receiving-header-expenses-and-valuation.md
?? tasks/done/ATV-068-receiving-navigation-and-empty-receipts.md
?? tasks/done/ATV-069-batch-less-receipts-and-deletion.md
?? tasks/done/ATV-070-receipt-list-manager-screen-and-expense-revisions.md
?? tasks/done/ATV-071-receipt-status-filter-and-distinct-destinations.md
?? tasks/done/ATV-072-piece-entry-readonly-and-mixed-allocation.md
?? tasks/done/ATV-073-manager-batch-grouping-and-confirmation.md
?? tasks/done/ATV-074-required-field-highlighting-and-toggle-alignment.md
```

Untracked **receiving-related** code/schema files are therefore:

```text
apps/api/src/modules/batches/batch-redaction.ts
apps/api/src/modules/batches/expense-allocation.ts
apps/api/src/modules/batches/expense-allocation.test.ts
apps/api/test/delivery-expenses.e2e.test.ts
apps/web/src/app/receipts/[deliveryId]/page.tsx
apps/web/src/features/manage-batches/ui/delivery-expenses.tsx
apps/web/src/features/manage-batches/ui/product-combobox.tsx
apps/web/src/features/manage-batches/ui/receipt-manager-page.tsx
packages/contracts/src/delivery-expenses.ts
packages/database/prisma/migrations/20261118160000_delivery_expenses/migration.sql
packages/database/prisma/migrations/20261118180000_expense_application_ledger/migration.sql
```

(The `docs/screenshots/atv-0xx/` and `tasks/done/ATV-066…074` entries are ADR/UX
evidence and task records, not executable behaviour.)

> Capture note: the block above is the tree **as captured**. The three files
> added by this task (`docs/audits/receiving-inventory-before.md`,
> `docs/audits/receiving-inventory-method.md`,
> `tasks/done/ATV-075-receiving-inventory-before-redesign.md`) are not in it, so a
> later `git status --porcelain=v1` shows three additional untracked paths (71
> entries instead of 68). No other file changed.

### 2.3 Fingerprint

108 files, sorted by path, SHA-256 each. Aggregate digest of the sorted
`<hash>  <path>` lines (UTF-8, `\n`-joined, no trailing newline):

```text
74332527353199a95daa3b83177a414ec138c2743512637773bcc0e8ad156dc4
```

```text
042a344f6f52e5e9f51ee367efae661de045094dd40af2bb07dee9ae4041eb2c  apps/api/src/modules/batches/bag-barcode.ts
5e902e91803f592b6a017207556ebf7d2bc31b6eab525ff4b95abdf0c310f287  apps/api/src/modules/batches/bags.controller.ts
4188331152ece2d3384942d68db4c3282f2a925a546c5ae477f58d4f62613ff9  apps/api/src/modules/batches/batch-code.ts
9c5f588da2b10df0893efa34e306bd61354bfaae45095588b1c7a0a9ef992b1d  apps/api/src/modules/batches/batch-redaction.ts
04981daea0b3cda240f583724b2a9c9cb2f1cf209064a9b1ada95e3e0084913a  apps/api/src/modules/batches/batch.mapper.ts
5cbf6b4d94f6eab598dd413e40ab6ee49321ffa146e84c3ff282b894eba6cbd0  apps/api/src/modules/batches/batches.controller.ts
eaf385fb6c6317b76a08daf296a654ddf70d787367648d0f0e6f4c5d8eee19f6  apps/api/src/modules/batches/batches.module.ts
85970d55f6a013d33354f873efa5d934bb97e6af5d4f4000761c2f85f71f9fce  apps/api/src/modules/batches/batches.service.ts
97f09bae5c09636c06f0497610dce4b66496009ab36ea880e21560b1e51c56d3  apps/api/src/modules/batches/delivery-code.test.ts
d5558516cc9ed0879cfca41b737cb7e1c620f047d5be75ce1ac9f98f4849db29  apps/api/src/modules/batches/delivery-code.ts
0e4486d1f0cc88fee8911e170fa07525883dd903f343ea5c593f4e18424fa0b2  apps/api/src/modules/batches/deliveries.controller.ts
398f6b3c166f3eae7786d0aa2e9b25cece6aa914a878b0bb2d35efc9460ccd06  apps/api/src/modules/batches/expense-allocation.test.ts
bf86e519a0813c832093dfeba8e593fe0537725c14c5e8eb3466d284e318ef4d  apps/api/src/modules/batches/expense-allocation.ts
9e28ed4396aa7a28dfeee27f1a7dad38ff7b5b773e850e03361ce5f12dafb4e0  apps/api/src/modules/packaging-types/packaging-type.mapper.ts
b5fb4b9bb82a3d8fbd4187a09537fb1b372f003a322440d478c2cfc23e8b004a  apps/api/src/modules/packaging-types/packaging-types.controller.ts
fff69e12bc0c318a47daf0d631b90e07992edc7355d6f0f654eabc4a901a3d20  apps/api/src/modules/packaging-types/packaging-types.module.ts
71b1d620de16ecf630223ca2d024b52bc419305e1e0f730ff1d15a536b4dc705  apps/api/src/modules/packaging-types/packaging-types.service.ts
1ea657099f57b2722e8a9402def0c503efe482d927c70d84bd2f59b677263135  apps/api/src/modules/receipts/receipt.mapper.ts
45740fb58b4f5b25f74a3493647ae3de90a2fb5a9b7f604bb34f1c5ff9a02727  apps/api/src/modules/receipts/receipts.controller.ts
5dba41cd6af3fc614839e58cc7552f2dd64b050f5ed3af074a3cdfb5dc774b90  apps/api/src/modules/receipts/receipts.module.ts
cb10afb7b899ad66e39ba91972eec5f0fdde22c78712b58f73dad0458561753b  apps/api/src/modules/receipts/receipts.service.ts
bf9ec26401448fc2f86200673082c12f42f7c4d8061493e9ff49fb610b0001c0  apps/api/src/modules/receiving-discrepancies/discrepancy.mapper.ts
a80fcf55d3fc5d93d32a3657f6fc5589172ecb8da7d1898f802b49d37366ee6d  apps/api/src/modules/receiving-discrepancies/receiving-discrepancies.controller.ts
de502aa8d3ce8a1882428c3b5041915fe417d39cc060cabf9307cd44bdef1665  apps/api/src/modules/receiving-discrepancies/receiving-discrepancies.module.ts
1b4b87ee51a86f56fb9ff34b64aece164ebad46489beb64bbdc1b2743bb78eb1  apps/api/src/modules/receiving-discrepancies/receiving-discrepancies.service.ts
843445b9f41868214350be653436a6f07daa39a037a696a196ad42138cd95a95  apps/api/src/modules/stock/stock-summary.test.ts
204b765ede0a3065ab16d0b617ffccc0af30f0edc0b7a17daf7121b9e98d2e5b  apps/api/src/modules/stock/stock-summary.ts
ac16270e3eb17bf43ff81f82da4bb4731f612322ca79b7352d539b87cc768409  apps/api/src/modules/stock/stock.controller.ts
6f8175c2e041fa105064df28eed9ba0f592aaced89571636a575ee386995d200  apps/api/src/modules/stock/stock.module.ts
3082019a2c6b189371ebfb6ef51db6cea5e2349b50c84e6a59bbec9c0b5f1806  apps/api/src/modules/stock/stock.service.ts
bd98bdf84c93e26874c183c7695fc380343f8d368c294c8cf1f9d61c357a68f9  apps/api/test/batches.e2e.test.ts
1b08d22cef6a43b002ad4cf675c6b86198ca3e56a17c39a07503f0fe3d7c09cb  apps/api/test/delivery-expenses.e2e.test.ts
1fdf7f523086cc212b3c0727a7f391ff4d50a3212e7ad42478d1c0eb28e6c415  apps/api/test/packaging-types.e2e.test.ts
6144e3a72c6cb6cf809abced745ee725d548999b01cac9823dbb809fe1fbd1e4  apps/api/test/piece-batches.e2e.test.ts
0ee976dda753edcf8dcafac887ef2de403acdcd7f4f8777f7e649a311caf3b3a  apps/api/test/receipts.e2e.test.ts
ee5bc1f1e332569e8737e8392f7b4d489ad3ed4e07d0b62f0e61e820bc190422  apps/api/test/receiving-discrepancies.e2e.test.ts
7887d39fe0d442e730f1b23460192dcd2d635d7114e049798ed31a5dfd4fd1ab  apps/web/src/app/receipts/[deliveryId]/page.tsx
95dbaa044fcacf71ff6aeda170a9c8c280f389400b78e6473fbfd695a95ce354  apps/web/src/app/receipts/batches/[id]/page.tsx
f79dc2ac77b4c2465175ad0bc2db69e1ef32fa97e7a413d12290bdf73791f9fd  apps/web/src/app/receipts/page.tsx
dadd87e50fa97cc6712cc8f6adbaec8353f4411e7766a0ef4b089cab48949224  apps/web/src/app/receiving/[deliveryId]/batches/[batchId]/page.tsx
dadd87e50fa97cc6712cc8f6adbaec8353f4411e7766a0ef4b089cab48949224  apps/web/src/app/receiving/[deliveryId]/page.tsx
d2475a7c32eab97992340d41ed90ff0afbe33695159610f828a33504ea27385f  apps/web/src/app/receiving/new/page.tsx
575bc7b9c5ef2e2f7e8987bb65454f2720ce256fc69bc378031bef129fa8c79f  apps/web/src/app/receiving/page.tsx
a27e898d5b0cbc6dac3e091b3f742351b6ad3139295c50975af7f8d25c46eafe  apps/web/src/app/reports/discrepancies/[id]/page.tsx
f11971548cd2414729d93d07208d9687aedf1f39c1e36aadf5bcd85672a78d21  apps/web/src/app/reports/discrepancies/page.tsx
16c10475f7f650fdcab77401d9a331c5a6b87e194e5a4f55307355d2c94047c6  apps/web/src/entities/batch/batch.test.ts
6a89750a1365d4d94641b32f34c2fdf96a9cff969b7926a08b8998ccb48baee9  apps/web/src/entities/batch/batch.ts
5f67b7b871a7ab4390bfb1310daf5be8f8aa630842f736503cb52f02ecccca4f  apps/web/src/entities/batch/index.ts
6478a8c22cb7073496ceb5009a0d47afce8bd655ac8d2036a41f71a26ba88ae8  apps/web/src/entities/packaging-type/index.ts
fe12386e6e961da091f894c915b791e3e2049e204414a6476be76c7c4a71dfd6  apps/web/src/entities/packaging-type/packaging-type.test.ts
78e8cd32d76c7e11b7d226a75c67458442bfc9b7b489347fb38b80d2ab61eb9f  apps/web/src/entities/packaging-type/packaging-type.ts
15936dfbc8aba8fc61d4cdcb77f50f1b0b1a174f18ff5208b43a89c0434e741f  apps/web/src/entities/receiving-discrepancy/index.ts
7ca2c590ac5cf9e2f585205633b3248d5dddb36ee03f5a57df54ce0342041807  apps/web/src/entities/receiving-discrepancy/receiving-discrepancy.ts
7acb15bd7a55d4b818c5a4e97a69eb587c9205848915f751c7971378db4af060  apps/web/src/features/manage-batches/index.ts
db82d7c1983f9c3b47e90f2abfcbbc2862dbcb406f9b1f191c65ea7c3c953d60  apps/web/src/features/manage-batches/lib/batch-form.test.ts
73e5882547ee2b5dd045300369d6949e867d6d6f5bae37eac4a46d1731b2195e  apps/web/src/features/manage-batches/lib/batch-form.ts
61d13be69aefca6447202579b2f8b72bc4618658f98be28e608261eae52afea4  apps/web/src/features/manage-batches/lib/batch-list.test.ts
379657d9165e4465d804173f48b933be8c7ef897f9489ca4b58426e9e35084bb  apps/web/src/features/manage-batches/lib/batch-list.ts
d95286752916c5108404141c769a0f6c6c118baebd3f3628c27b3a18009ffc85  apps/web/src/features/manage-batches/lib/receiving.test.ts
ce736610224c69bcad0e0f71cfbf47ab81c592a2804d5fd7ea98d75dd76bd4ed  apps/web/src/features/manage-batches/lib/receiving.ts
92ba36201518320873b9cd6af7d6fb86d0925c477d30bd4c890266607f893f1c  apps/web/src/features/manage-batches/ui/bag-label.tsx
15153f726abfe36b2251096f7030807a09d3d648604bd1412bfde8514d522315  apps/web/src/features/manage-batches/ui/batch-details-page.tsx
735dab172c3228b16f6d1dd5f9baaf3376807bc107b004a47a862407a839fdfe  apps/web/src/features/manage-batches/ui/batch-registration-editor.tsx
fbf903273ba7891f228f3b3dcea1b56929b8d4cb060286c1a79b10967c93d7bc  apps/web/src/features/manage-batches/ui/delivery-expenses.tsx
f87b071798166c93cb5f17dbd53dc1532653be659dd3bde00651ec08c640b14c  apps/web/src/features/manage-batches/ui/gavimai-page.tsx
1a784bce6455860bd81c53de4750e586fed1ffbfc759882204156a748190655a  apps/web/src/features/manage-batches/ui/piece-label.tsx
dd121760d4f71831352847fa63bc6fa60067419e2a63da3ada7fa45eab36e9e2  apps/web/src/features/manage-batches/ui/product-combobox.tsx
2678115dcbf96fae3ee236b4487f30fbf23a0b05b230256bdb58e92dee5a7445  apps/web/src/features/manage-batches/ui/receipt-manager-page.tsx
d04de9205b7e8c6e1e52120515c29247d9c185470be2eb4d0ea43dedb6e51761  apps/web/src/features/manage-batches/ui/receiving-delivery.tsx
478b42b4d60ba36aef95d858e9b90497beac2c892689eedbe0412470c2d73c47  apps/web/src/features/manage-batches/ui/receiving-page.tsx
5e827dd12fd127d1a693221288baec2fd5507acb1dded21cd1cdbd2e7c905149  apps/web/src/features/manage-discrepancies/index.ts
da1379fc045ec78c4488f197580318fc11f9700f8830f294c17a53459011fa03  apps/web/src/features/manage-discrepancies/lib/discrepancy-list.test.ts
171d3699391f23a81add08688e3ea34b84443d17c47cca02adfc6c302e722965  apps/web/src/features/manage-discrepancies/lib/discrepancy-list.ts
54f3362d2e87956e08b5eded76a55671186f55cf8b10929aa7235c0a5a9069da  apps/web/src/features/manage-discrepancies/lib/settlement-form.test.ts
111c6757b9a622ecaaf06d5379a1889abdac60b55131c647f4f347c1877b4ec3  apps/web/src/features/manage-discrepancies/lib/settlement-form.ts
f17282be60ee970b12ae4b59adc818271e4009b0c6ae4452adbcdcb8b55074fc  apps/web/src/features/manage-discrepancies/ui/discrepancy-details-page.tsx
98ac4a95964dff057d17d0dcac4c4fd9f7b58e140c9dcafa61dbfbb991b53108  apps/web/src/features/manage-discrepancies/ui/discrepancies-page.tsx
bac6fbe64fdda1f56a85416e6801d4a3ef6c8ab6613ee38ac92e34264f434fb7  packages/contracts/src/batch-items.test.ts
dd74b90e21e99e5f215910f80a1a3519f19b23980fab7176a3616ab00739d3ef  packages/contracts/src/batches.test.ts
e89325bd924b5ac50fe2ee11978962518f5ee6da48d006e8a37aa623907dbdcd  packages/contracts/src/batches.ts
6732b1bcc98f3ba95e33d6dcc0770b975f03d14488693645e72fcb80892a03b9  packages/contracts/src/delivery-expenses.ts
46f4820188f2a37d233b2673f540f49990d979f4f52c60da3cc5533e6f5f53a6  packages/contracts/src/incoming-deliveries.test.ts
e8cad69769f8abe5c39de7cf4f3138019d4ad49d3128b379dc3f028e621a780f  packages/contracts/src/incoming-deliveries.ts
27f325a17e358aa0bc825dfd9d8502fa3994938f18489efbedf40fca7ec9c5af  packages/contracts/src/index.ts
c792105a33c5195f9639e8067df8d78792602e56b14ae8652e958102ecfa9852  packages/contracts/src/packaging-types.test.ts
c267e369f2f81cedd65ca54a67f263ac5f17fae056aba7ea91fdb6fe266c1b2f  packages/contracts/src/packaging-types.ts
6cf1839fcf6763322aaaa4a56d3082d7998d54a2aba6b0758e3191f32b6dfc24  packages/contracts/src/receipts.test.ts
cfb1d785f25f48748f8abd5a2e9a02b92b05cf894a16d705e47a35df8ac50854  packages/contracts/src/receipts.ts
755672dc665473baa00d4803ba77c9659e8fe368c4b1d7c6355a9aecbc9c0998  packages/contracts/src/receiving-discrepancies.test.ts
e976251061f2e1f9f83bcd514687519e839eb16de5222dcb1bd23e42440c25cb  packages/contracts/src/receiving-discrepancies.ts
d86c898af55128c16fa5bcce3355cf7c95e8aa83d325bd048d9eb5a9cdfa62b9  packages/contracts/src/stock.ts
6908b16b117c39d7890366ed5022cad0e25e2786940919a5ff9b9251adfc1332  packages/database/prisma/migrations/20260921110025_warehouse_placement/migration.sql
221ff88dd08650e08fd4df952167a0f4cd74208dbaa8257c33ab20aaade5c280  packages/database/prisma/migrations/20260921110842_optional_receipt_location/migration.sql
16518ea85a0ad595975c44ebe68bfafeb06df50b019f7f4eee93192c497c592a  packages/database/prisma/migrations/20260929092248_receiving_batches_and_bags/migration.sql
c71a10d79941c0a60e1bd0688ef2d5a5ccfebf36d70e110b25f53955add471c3  packages/database/prisma/migrations/20260929120000_batch_reconciliation/migration.sql
fc26d55d30ecfd6ef6ee7f907bc7b2e6cd24de8bc103fdb1124a7b788f9956d4  packages/database/prisma/migrations/20260929131517_handling_unit_corrections/migration.sql
e7fd4b62017bae48379706a5cc291b12892f0957ea9fb5e2f09a0c7274b78866  packages/database/prisma/migrations/20260929140000_handling_unit_quantity/migration.sql
b4b7364951ce491e53b874fb19be8c7ee8bef2fc3d22694d0dfadac0f3858120  packages/database/prisma/migrations/20260930100000_incoming_deliveries/migration.sql
8ea8b90e0305cfcda82cf758c06ea3b9b479091a445789de027a2f6b31502fda  packages/database/prisma/migrations/20260930110000_packaging_types/migration.sql
ba0755cb42452132751d40af0a125121e400a4b93f4550a8665f49c6c86aeda9  packages/database/prisma/migrations/20260930120000_receiving_discrepancies/migration.sql
df9675ad751949503340b5dc00289fb8bb91bcfb8a4f4bfa7929c0b80e67accb  packages/database/prisma/migrations/20260930130000_batch_delivery_local_code/migration.sql
c7c73692f1f4c8f9241e43d953b79f13c87af0a63658f41fa49d7adf4cd6f6e9  packages/database/prisma/migrations/20260930140000_drop_packing_forms/migration.sql
ede7709b70d26e5817b3f38b67e92ebbd9484ba7440d86a9afe1d592c6ed13f0  packages/database/prisma/migrations/20260930150000_discrepancy_settlements/migration.sql
47ce544b76c70dfd472e0b7c1b9ed706a7478d3863b2a0386ba27b5013c4e942  packages/database/prisma/migrations/20260930160000_piece_batches/migration.sql
6f4e8a93945cacd35ad3d33563034f717136a25a01f0e883707ecd72fc21aef0  packages/database/prisma/migrations/20260930170000_piece_reconciliation/migration.sql
7b410375d84a166a22aa82d8b1d0996461a046e1b06913bceb671acef71e0df0  packages/database/prisma/migrations/20261118160000_delivery_expenses/migration.sql
17565f89204067cc1d6d48057e81634ab99333281ca3447012ced94b4a757095  packages/database/prisma/migrations/20261118180000_expense_application_ledger/migration.sql
4bff905cbfe3b4c25f159e96007f78bcde3403c4693b6fa95d815861190d4603  packages/database/prisma/schema.prisma
```

Notes:

- `apps/web/src/app/receiving/[deliveryId]/page.tsx` and
  `.../batches/[batchId]/page.tsx` are byte-identical (same hash); both render
  `ReceivingDeliveryPage`, and the component derives the view from the URL params.
- The two newest migrations are untracked, so the fingerprint covers them but the
  Git commit does not.
- Paths in `docs/`, `tasks/` and `docs/screenshots/` are deliberately excluded
  from the fingerprint; they are records, not behaviour.

### 2.4 Evidence used and limitations

- **Source reference** — primary evidence for every row (`path:line`, function
  name).
- **Test evidence** — exact e2e/unit test names from the files in §2.2.
- **HTTP observation** — 2026-11-19 against the running local dev servers: web
  `http://localhost:3011` returned the shell with the auth gate text
  `Kraunama paskyra…` for `/receipts`; API `http://localhost:3010` returned
  `401 {"message":"Authentication required"}` for `GET /deliveries`, `/batches`,
  `/receipts`, `/bags/by-barcode/0000000000000`,
  `/receiving-discrepancies`, `/stock/summary`.
- **Browser observation** — **not performed as an authenticated walk.** No
  browser automation is available in this environment, and no live receipt data
  was read or written. Every UI claim below comes from the rendered component
  source, which is the exact code the browser executes. Where a live click-through
  would be needed to decide a question, it is recorded as an `UNRESOLVED` finding
  in §9 rather than guessed.

## 3. Route map (UI)

| Route | Guard | Entry | Renders | Notes |
|---|---|---|---|---|
| `/receipts` | authenticated only (`AppShell` without roles) | sidebar `Priėmimas`; `← Priėmimų sąrašas`; `REDIRECT` target | `GavimaiPage` — one row per receipt | all four roles can open it; only ADMIN + receiving roles see actions |
| `/receiving` | none (redirect) | old links/bookmarks | `redirect("/receipts")` | no sidebar link; `activeHrefs` keeps `Priėmimas` active |
| `/receiving/new` | `RECEIVING_ROLES` = ADMIN, WAREHOUSE_WORKER | home `Naujas priėmimas`; list `Naujas priėmimas` | `ReceivingPage` — supplier + arrival date | opening creates no record |
| `/receiving/[deliveryId]` | receiving roles | G… code link in the list; after `POST /deliveries`; back from batch editor; `Redaguoti/Peržiūrėti priėmimą` | `ReceivingDeliveryPage` — receipt header, `Priėmimo turinys`, `Nauja partija`, active batch entry, labels | read-only when every batch is CONFIRMED |
| `/receiving/[deliveryId]/batches/[batchId]` | receiving roles | `Priėmimo turinys` rows; `POST /deliveries/:id/batches` redirect; `Redaguoti partiją` | same `ReceivingDeliveryPage`, batch param present | batch editor + units; CONFIRMED batch is read-only |
| `/receipts/[deliveryId]` | `ADMIN` | list `Tvirtinti` / `Peržiūrėti`; batch detail `Priėmimo G… išlaidos` | `ReceiptManagerPage` — per-batch confirmation + `Priėmimo išlaidos` | **direct URL works for ADMIN only**; no worker access |
| `/receipts/batches/[id]` | `ADMIN` | **no inbound link anywhere** | `BatchDetailsPage` — batch review + confirmation + label + correction history | direct-URL-only legacy detail (finding F-02) |
| `/reports/discrepancies` | `ADMIN` | sidebar `Ataskaitos → Neatitikimai` | `DiscrepanciesPage` | register of long-lived discrepancies |
| `/reports/discrepancies/[id]` | `ADMIN` | register row | `DiscrepancyDetailsPage` | settlement form (WEIGHT only) |
| `/` | authenticated | sidebar `Suvestinė` | `HomePage` — stock cards + `Naujas priėmimas` | receiving-role only action |

`/receiving` (bare) has exactly one behaviour: server-side redirect to
`/receipts`. `/receiving/new` is the record-free form. `/receiving/[deliveryId]`
is the receipt editor. `/receiving/[deliveryId]/batches/[batchId]` is the batch
editor (same component, different params).

## 4. Walk by role and scenario

### 4.1 Warehouse worker (`WAREHOUSE_WORKER`)

1. **Home** → `Naujas priėmimas` (`/receiving/new`). The button is shown only for
   `RECEIVING_ROLES` (`entities/batch/batch.ts:31-34`, `features/home/lib/home.ts`).
2. **New receipt**: select an active `SUPPLIER` and an arrival date; `Pradėti
   priėmimą` creates the receipt and navigates to `/receiving/<id>`. Leaving the
   page creates nothing (`receiving-page.tsx:32-39`).
3. **Empty receipt**: `Priėmimo turinys` shows
   `Šiame priėmime dar nėra užregistruotų išteklių.`; `Nauja partija` is shown.
4. **Start a batch**: choose `Partijos tipas` (`Svorinė` default / `Vienetinė`),
   then `Išteklius` (WEIGHT only) and `Sandėlis`; `Pradėti registruoti` resolves
   or creates the batch and navigates to the batch URL. The same
   `(delivery, resource, warehouse)` resolves the **same** batch; each PIECE
   action creates a **new** batch.
5. **WEIGHT packages**: `Tara`, `Vieta`, `Bruto svoris`; `Taros svoris` / `Neto
   svoris` preview; `Išsaugoti` returns to the form, `Išsaugoti ir spausdinti`
   opens the label and triggers the browser print dialog. Only the gross weight
   resets; the batch, `Tara` and last location stay.
6. **Package list** (`Partijos pakuotės`): `Barkodas`, `Vieta`, `Neto svoris`,
   `Užregistruota`; actions `Taisyti`, `Anuliuoti`, `Spausdinti`. Voided packages
   move to `Anuliuotos pakuotės` (muted).
7. **PIECE products**: `Prekė` (searchable combobox), `Kiekis, vnt.`, `Vieta`;
   `+ Nauja prekė` quick-creates an active resource; Save/Save-and-print create a
   group with its own barcode; `Iš viso: N vnt.`; corrections/voids only while
   pending; per-group `Spausdinti`.
8. **Partial vs full confirmation**: a partially confirmed receipt keeps
   `Nauja partija` and lets pending batches be edited; a fully confirmed receipt
   replaces the block with `Priėmimas patvirtintas. Duomenų keisti negalima; …`
   and keeps labels printable. A CONFIRMED batch URL renders read-only.
9. **Back**: `← Priėmimų sąrašas` (top and bottom of the receipt card) → `/receipts`
   with the last filters restored from `sessionStorage`. The batch editor's parent
   action is `Redaguoti priėmimą` (pending) or `Peržiūrėti priėmimą` (read-only) →
   the parent receipt, not the batch detail.
10. **PIECE resume**: a pending PIECE batch keeps its route and code when leaving
    and re-entering; no new `P01/P02` is allocated on resume.

### 4.2 Manager (`ADMIN`)

1. **List** (`/receipts`): one row per receipt; `Būsena` filter defaults to
   `Laukia patvirtinimo`; `Patvirtintos partijos` shows `confirmed iš total` or
   `—`; `Ištrinti priėmimą` only for `Be partijų` rows without non-zero expenses.
2. **Operational receipt** (`/receiving/[deliveryId]`): the same worker screen; the
   G… link always opens it, for every status and every receiving role.
3. **Manager receipt** (`/receipts/[deliveryId]`): one bordered group per batch.
   Collapsed: `Partija`, `Prekė`, `Priimta`, `Dokumentuose`, `Skirtumas`,
   `Įsigijimo vertė, €`, `Būsena / veiksmas`; toggle `Rodyti prekes` /
   `Slėpti prekes` (multi-product PIECE) or `Dokumento duomenys`; one
   `Patvirtinti PXX` button per pending batch.
4. **Confirm WEIGHT**: `Dokumentinis svoris, kg` + `Įsigijimo vertė` (+ optional
   date/number); exact match confirms directly; mismatch opens
   `Patvirtinti PXX su neatitikimu?` and confirms with acknowledgement.
5. **Confirm PIECE**: `Pagal prekes` (one input per product) or `Bendras kiekis`;
   `Dokumento forma` radio; `Prekė | Faktiškai | Dokumentuose | Skirtumas`; any
   mismatch → acknowledgement dialog naming the mismatched products.
6. **Expenses**: `Priėmimo išlaidos` below the groups; enter `Transportas, €` and
   `Muitinė, €`, pick `Pagal vertę` / `Po lygiai`; 250 ms debounce previews the
   per-batch shares, allocated/unallocated totals and last-applied audit;
   `Pritaikyti paskirstymą` writes the ledger and updates confirmed valuations.
7. **Batch detail** (`/receipts/batches/[id]`, direct URL only): compact header
   `Priėmimas G… / PXX`, read-only package list, `Pataisymų istorija`,
   type-specific confirmation form, `Priėmimo G… išlaidos` link. This duplicates
   the manager confirmation for one batch (finding F-01).
8. **Discrepancies**: `Ataskaitos → Neatitikimai`; register defaults to `Atviri`;
   detail shows immutable origin + settlement history; settlement is WEIGHT-only
   (PIECE says `Vienetinių neatitikimų padengimas dar nenumatytas.`).

### 4.3 Scenario coverage

| Scenario | Where it is handled | Evidence |
|---|---|---|
| Empty receipt | list row `Be partijų`; `Priėmimo turinys` empty text; delete action | `batch-list.ts:184-217`, `gavimai-page.tsx:340-355`, `receiving-delivery.tsx:846-849` |
| Pending receipt | default list filter; editable units; manager `Patvirtinti PXX` | `batch-list.ts:52-59`, `receipt-manager-page.tsx:823-833` |
| Partially confirmed | receipt stays in `Laukia patvirtinimo`; pending siblings editable; confirmed frozen | `batch-list.ts:263-279`, `receiving-delivery.tsx:746-748,877-972` |
| Fully confirmed | list `Patvirtintas`; operational screen read-only; labels only | `batch-list.ts:266-271`, `receiving-delivery.tsx:967-972` |
| WEIGHT receipt | packages only; kg difference | `batches.service.ts:1067-1288`, tests below |
| PIECE receipt | item lines only; pieces difference | `batches.service.ts:1322-1633` |
| Mixed WEIGHT + PIECE receipt | allowed; `BY_VALUE` switches to `ACQUISITION`; separate stock cards | `expense-allocation.ts:46-78`, `stock-summary.ts:84-101` |

## 5. Inventory

Legend: `Pending` = batch status `PENDING`; `Confirmed` = `CONFIRMED`.
`W` = WEIGHT/Svorinė; `P` = PIECE/Vienetinė.

### 5.1 Entry points, links and role gates (NAV)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-NAV-01** One `Priėmimas` sidebar destination for list + workflow ↔ RCV-LIST-01 | all authenticated roles; sidebar `Operacijos → Priėmimas` | `widgets/app-shell/model/navigation.ts:110-118`; `entities/batch/batch.ts:41-44` (`GAVIMAI_ACTION`) | none | destination active for `/receipts` and `/receiving*` via `activeHrefs` | source; `navigation.test.ts` |
| **RCV-NAV-02** Home primary action `Naujas priėmimas` ↔ RCV-RCPT-01 | receiving roles only; `Suvestinė` header | `features/home/ui/home-page.tsx:90,106-114`; `features/home/lib/home.ts:10-12`; `RECEIVE_ACTION` `entities/batch/batch.ts:31-34` | none | role gate is UI only; server re-checks | source |
| **RCV-NAV-03** Bare `/receiving` redirects to `/receipts` | old links, bookmarks; no current UI link | `app/receiving/page.tsx:1-10` | none | unauthenticated redirect happens client-side after shell auth | source; `receiving.test.ts:405-407` |
| **RCV-NAV-04** List primary `Naujas priėmimas` → `/receiving/new` | receiving roles; list header | `gavimai-page.tsx:202-207` | none | hidden for ACCOUNTING / PRODUCTION_MANAGER | source |
| **RCV-NAV-05** G… receipt code → operational receipt `/receiving/[deliveryId]` | every authenticated role that can open the list | `gavimai-page.tsx:318-326` | none | route then enforces `RECEIVING_ROLES` → 403 for other roles (finding F-19) | source; `batch-list.test.ts:505-520` |
| **RCV-NAV-06** `Tvirtinti` (pending) / `Peržiūrėti` (fully confirmed) → manager receipt `/receipts/[deliveryId]` ↔ RCV-RECON-01 | ADMIN only (`canConfirm`) | `gavimai-page.tsx:62,356-372` | none | `Tvirtinti` on `PENDING` receipt status, `Peržiūrėti` otherwise; workers see neither | source; `batch-list.test.ts:505-520` |
| **RCV-NAV-07** Every `Priėmimų sąrašas` action → `/receipts` | operational receipt (top+bottom), manager receipt, list back | `receiving-delivery.tsx:781-784,1074-1078`; `receipt-manager-page.tsx:441-443,455-457`; `DELIVERIES_LIST_BACK_LABEL` `receiving.ts:83` | restores list filters from `sessionStorage` (`batch-list.ts:91-93`) | label surface replaces the bottom back link | source; `receiving.test.ts:423-428` |
| **RCV-NAV-08** Batch editor parent action `Redaguoti priėmimą` / `Peržiūrėti priėmimą` | receiving roles; batch editor header | `receiving-delivery.tsx:945-965`; labels `receiving.ts:85-89` | none | label depends on `canReceiveStock` and batch `PENDING` | source |
| **RCV-NAV-09** `Priėmimo G… išlaidos` → manager receipt | ADMIN; batch detail header | `batch-details-page.tsx:1286-1291` | none | ADMIN-only page | source |
| **RCV-NAV-10** `/receipts/batches/[id]` ADMIN batch review | **direct URL only — no inbound link** | `app/receipts/batches/[id]/page.tsx:1-10`; `batch-details-page.tsx`; unused `batchDetailHref` `batch-list.ts:417-420` | none on load | see F-02 | source; grep for `receipts/batches` finds tests only |
| **RCV-NAV-11** Route guard matrix | all roles | `AppShell` `roles` prop; `RequireAuth` `features/auth/ui/require-auth.tsx:31-44`; page files | none | list = any authenticated; operational/new/batch = ADMIN+WAREHOUSE_WORKER; manager + batch detail + discrepancies = ADMIN | source; HTTP 401 without cookie §2.4 |
| **RCV-NAV-12** `Ataskaitos → Neatitikimai` register | ADMIN only | `navigation.ts:143-155` | none | `excludeRoles: WAREHOUSE_WORKER`; child `requiredRoles: ADMIN`; `visibleNavSections` hides the whole destination when no child is visible, so ACCOUNTING/PRODUCTION_MANAGER get no `Ataskaitos` entry | source |

### 5.2 Receipt list (LIST)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-LIST-01** One row per receipt even with several batches | `/receipts`; all authenticated roles | `gavimai-page.tsx:57-451`; `receiptRows` `batch-list.ts:243-312` | reads `GET /deliveries`, `GET /batches`; no writes | shows `Be partijų` rows only under `Visos` | source; `batch-list.test.ts` |
| **RCV-LIST-02** Status filter `Laukia patvirtinimo` / `Patvirtinta` / `Visos` | list filter panel | `batch-list.ts:39-59,266-279`; `gavimai-page.tsx:211-227` | receipt status derived, never stored | default includes partially confirmed receipts; `NEEDS_CONFIRMATION` persisted value maps to `PENDING` (`batch-list.ts:104-109`) | source; `batch-list.test.ts` |
| **RCV-LIST-03** Supplier filter | list | `supplierFilterOptionsWithReceipts` `batch-list.ts:382-398`; applied at receipt level `:281-283` | reads delivery supplier | includes suppliers with only zero-batch receipts; option label `Visi` | source |
| **RCV-LIST-04** Resource filter (WEIGHT-only semantics) | list | options `batch-list.ts:400-407` (skips `resourceId === null`); match `:293-304` | reads batch resource | PIECE batches can never match; zero-batch receipts excluded when this filter is set; this is a WEIGHT-only filter by design (see RCV-MODE-05) | source |
| **RCV-LIST-05** Warehouse filter | list | `batch-list.ts:409-415`; `matchesBatchSpecificFilters` `:219-234` | reads batch warehouse | receipt matches once if any batch matches | source |
| **RCV-LIST-06** Arrival date range (inclusive) | list | `DateInput` `gavimai-page.tsx:249-266`; `withinArrivalRange` `batch-list.ts:136-145` | reads `delivery.arrivalDate` as `yyyy-mm-dd` | no default bound | source |
| **RCV-LIST-07** Batch-code search | list | `gavimai-page.tsx:267-277`; `batch-list.ts:229-232` | case-insensitive `includes` on `batch.code` | zero-batch receipts cannot match | source |
| **RCV-LIST-08** `Atstatyti filtrus` | list | `gavimai-page.tsx:278-288`; `hasActiveBatchFilters` `batch-list.ts:128-134` | resets to defaults incl. status | button only when non-default; reset returns to default queue | source; ATV-066 record |
| **RCV-LIST-09** Filter persistence across navigation | list | `BATCH_LIST_FILTERS_STORAGE_KEY` `batch-list.ts:91-93`; `gavimai-page.tsx:112-132` | writes `sessionStorage`, never the DB | session-scoped; malformed value falls back | source; `receiving.test.ts` |
| **RCV-LIST-10** Receipt status derivation | list, manager, operational screen | `receiptRows` `batch-list.ts:243-312`; `allConfirmed` `receiving-delivery.tsx:746-748`; API `pendingBatchCount` `batches.service.ts:294-301` | not persisted | `NO_BATCHES`, `PENDING` (any pending), `CONFIRMED` (all confirmed) | source; `batches.e2e.test.ts` "derives pendingBatchCount…" |
| **RCV-LIST-11** Pagination after grouping (20/page) | list | `RECEIPT_PAGE_SIZE` `batch-list.ts:315`; `paginateReceiptRows` `:327-345`; UI `gavimai-page.tsx:381-412` | client-side slice | page resets on filter change | source |
| **RCV-LIST-12** `Patvirtintos partijos` label | list column | `confirmedBatchesLabel` `batch-list.ts:211-217` | derived | `—` for zero batches | source |
| **RCV-LIST-13** `Ištrinti priėmimą` for zero-batch receipts ↔ RCV-RCPT-04 | list row; receiving roles | `gavimai-page.tsx:150-169,340-355,414-448`; labels `batch-list.ts:21-31` | `DELETE /deliveries/:id` | hidden when `hasNonZeroExpenses`; dialog text says only zero-batch/zero-expense receipts are eligible | source; `batches.e2e.test.ts` deletion tests |

### 5.3 Receipt lifecycle (RCPT)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-RCPT-01** New-receipt form that creates nothing on open | `/receiving/new`; receiving roles | `receiving-page.tsx:32-187`; `createDraftDelivery`/`deliveryFormError` `batch-form.ts:66-80` | none until submit; arrival date defaults to today | supplier must be an active SUPPLIER (server) | source; `batches.e2e.test.ts` "creates a delivery…" |
| **RCV-RCPT-02** Create receipt with supplier + arrival date | form `Pradėti priėmimą` → `POST /deliveries` → `/receiving/<id>` | `receiving-page.tsx:86-114`; `batches.service.ts:164-196`; contract `incoming-deliveries.ts:58-66` | inserts `incoming_deliveries` (`code`, `supplier_id`, `arrival_date`, `created_by_id`) | no warehouse/resource on the receipt; no vehicle | source; e2e "creates a delivery with a GYYMM-NN code…" |
| **RCV-RCPT-03** Receipt code `GYYMM-NN` | server on create | `delivery-code.ts:19-31,37-47`; `batches.service.ts:2060-2082` | `incoming_deliveries.code` unique; month sequence, max 99 (`DELIVERY_CODE_EXHAUSTED`) | retries on unique conflict (5 attempts) | source; e2e "assigns a monthly sequence…", "rejects … exhausted (99)" |
| **RCV-RCPT-04** Delete a started receipt with no batches | list row action; receiving roles | `batches.service.ts:206-241`; controller `deliveries.controller.ts:129-134` | locks delivery `FOR UPDATE`; rejects `DELIVERY_HAS_BATCHES` / `DELIVERY_HAS_EXPENSES`; cascade deletes a zero-amount expense | never allowed once any batch exists | source; e2e deletion tests (579-668) |
| **RCV-RCPT-05** Receipt header read (supplier, arrival date, code) | operational + manager screens; list | `toDelivery` `batch.mapper.ts:271-293`; `GET /deliveries`, `GET /deliveries/:id` | reads delivery + supplier name + expense presence | `hasNonZeroExpenses` exposed to every authenticated reader | source; finding F-29 |
| **RCV-RCPT-06** Edit receipt header (supplier/arrival date) | batch editor `Priėmimo duomenys` → `PATCH /batches/:id/registration` | `batch-registration-editor.tsx:47-74,114-138`; `batches.service.ts:847-869` | updates `incoming_deliveries.supplier_id` / `arrival_date` for **all** batches | blocked with `DELIVERY_HAS_CONFIRMED_BATCHES` if any sibling is confirmed | source; e2e "protects shared receipt fields when a sibling batch is confirmed" |
| **RCV-RCPT-07** Receipt contents table + batch navigation | operational screen | `receiving-delivery.tsx:842-875`; `deliveryBatches` `receiving.ts:92-99` | reads batch summary | rows link to the batch URL; header `Svoris / vnt.` covers both modes | source |
| **RCV-RCPT-08** Read-only receipt when every batch is confirmed | operational screen | `receiving-delivery.tsx:746-748,877-884,967-972` | none (UI only); server still authoritative | zero batches ⇒ not read-only | source; ATV-072 test coverage in e2e "rejects … after confirmation" |
| **RCV-RCPT-09** Zero-batch receipt representation | list `Be partijų`; operational empty text | `batch-list.ts:184-198,266-271`; `receiving-delivery.tsx:846-849` | derived | supplier/date filters still apply; batch-specific filters exclude it | source |
| **RCV-RCPT-10** List load failure state | list | `gavimai-page.tsx:75-110,291-294` | none | on error only a toast is shown; the table keeps `Kraunama…` because `batches`/`deliveries` stay `null` (finding F-21) | source |

### 5.4 Batch lifecycle (BATCH)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-BATCH-01** Start or resolve a WEIGHT batch `(delivery, resource, warehouse)` | `Pradėti registruoti` → `POST /deliveries/:id/batches` → batch URL | `receiving-delivery.tsx:375-407`; `toResolveBatchPayload` `batch-form.ts:117-129`; `batches.service.ts:683-775` | inserts/returns `batches` row (`receiving_mode=WEIGHT`, `resource_id`, `warehouse_id`, `status=PENDING`) | resource + warehouse must exist and be active; same triple resolves the same batch; `@@unique(deliveryId, resourceId, warehouseId)` | source; e2e "resolves the same … batch and splits per warehouse" |
| **RCV-BATCH-02** Start a PIECE batch (new each time) | `Partijos tipas = Vienetinė` + warehouse | `receiving-delivery.tsx:883-896,917-934`; `batches.service.ts:698-717` | inserts `receiving_mode=PIECE`, `resource_id=null`, `status=PENDING` | `resourceId` rejected with `RESOURCE_NOT_ALLOWED`; no unique-combination reuse for PIECE | source; e2e "starts a PIECE batch with only a warehouse" |
| **RCV-BATCH-03** Delivery-local batch code `P01..P99` | server on batch create | `batch-code.ts:12-28`; `batches.service.ts:2037-2058` | `batches.code`; unique `(delivery_id, code)`; no `P100` (`BATCH_CODE_EXHAUSTED`) | resets per receipt; not printed on labels | source; e2e "numbers batch codes delivery-locally…", "rejects … overflow past P99" |
| **RCV-BATCH-04** Batch detail read with derived totals + suggestions | batch URL; manager loads per batch; ADMIN batch detail | `GET /batches/:id`; `batches.service.ts:964-1047`; `toBatch` `batch.mapper.ts:194-244` | reads `bags`, `items`, `bag_corrections`, `receiving_discrepancies`, `piece_reconciliation_lines`, delivery/warehouse/resource, receipt line | totals derived, never stored; suggestions from latest ACTIVE unit | source; e2e "exposes the resource category and last-used location on the detail" |
| **RCV-BATCH-05** Edit PENDING batch metadata (resource/warehouse) | batch editor `Partijos duomenys` | `batch-registration-editor.tsx:241-316`; `batches.service.ts:808-961` | updates `batches.resource_id` (WEIGHT only) / `warehouse_id`; appends `bag_corrections` LOCATION rows on relocation | resource change on PIECE → `BATCH_NOT_WEIGHT`; duplicate triple → `BATCH_ALREADY_EXISTS` | source; e2e "edits batch/resource/warehouse and receipt date without a new batch" |
| **RCV-BATCH-06** Relocation of active units on warehouse change | batch editor | `batch-registration-editor.tsx:287-314`; `batches.service.ts:896-943` | requires `relocationLocationId`; `updateMany` bags + items; one LOCATION correction per active bag | only while PENDING; location must belong to the target warehouse | source; e2e "requires a relocation location when changing warehouse with active units" |
| **RCV-BATCH-07** Pending/confirmed gating of every content mutation | all receiving screens | `lockPendingBatch` `batches.service.ts:2150-2189`; UI gates `receiving-delivery.tsx:791-813,974-976,1092,1295` | rejects `BATCH_CONFIRMED` | CONFIRMED is terminal; no reopen | source; e2e "rejects all direct content edits after confirmation" |
| **RCV-BATCH-08** Edit/confirm race protection | server | row lock `FOR UPDATE`; conditional `updateMany` `batches.service.ts:1783-1800` | serialises edit vs confirm; no partial write | 409 `BATCH_CONFIRMED` | source; e2e "serializes concurrent registration edit and confirmation" |
| **RCV-BATCH-09** ADMIN batch review screen (direct URL) ↔ RCV-RECON-10 | `/receipts/batches/[id]` | `batch-details-page.tsx:89-1259` | reads `GET /batches/:id`; writes via reconcile/confirm-piece | ADMIN guard; no inbound link (F-02) | source |
| **RCV-BATCH-10** Batch list filtered by status (`?status=`) | **only** discrepancy detail source-batch selector | `GET /batches?status=CONFIRMED`; `discrepancy-details-page.tsx:107-125`; `batches.controller.ts:64-71` | reads batches | web list itself fetches unfiltered `/batches` and filters client-side | source |
| **RCV-BATCH-11** Batch deletion | — | none exists | — | receipt delete requires zero batches; batch is never deleted | source; docs/batches.md:727-729 |

### 5.5 WEIGHT physical receiving (PHYS)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-PHYS-01** Package entry form (`Tara`, `Vieta`, `Bruto svoris`) | operational screen, WEIGHT batch, PENDING | `receiving-delivery.tsx:974-1072`; `bagFormError` `batch-form.ts:418-430` | client-only draft; net preview `netWeightOf` `receiving-delivery.tsx:157-167` | all three fields required; gross > 0 | source |
| **RCV-PHYS-02** Create package (`POST /batches/:id/bags`) | `Išsaugoti` / `Išsaugoti ir spausdinti` | `receiving-delivery.tsx:425-468`; `batches.service.ts:1067-1130` | inserts `bags`: `barcode`, `packaging_type_id`, `gross_weight`, `tare_weight_kg` snapshot, `net_weight`, `warehouse_location_id`, `status=ACTIVE`, `created_by_id` | PENDING batch + WEIGHT mode; active packaging; gross > tare; location in batch warehouse | source; e2e "generates unique … barcodes and derives the measured weight", "allows adding a package to a pending batch but not a confirmed one" |
| **RCV-PHYS-03** Server net/tare snapshot calculation | inside create/correct | `batches.service.ts:1094-1113` (create), `:1154-1214` (correct) | persists `tare_weight_kg` snapshot; `net_weight = gross − tare` | Decimal(14,3); no floating point; never client-supplied | source; e2e "computes net weight server-side from the packaging tare", "snapshots the packaging tare and is immune to later master edits" |
| **RCV-PHYS-04** Split Save vs Save-and-print | two submit buttons, one create path | `receiving-delivery.tsx:1045-1069`; state helpers `applyUnitSaved`/`applyUnitSavedSilently` `receiving.ts:209-239` | one package per click; Save-and-print opens label; only gross resets | failure keeps the draft, opens no label | source; `receiving.test.ts` |
| **RCV-PHYS-05** Active package list (newest first) + reprint | operational screen | `activeBatchUnits` `receiving.ts:373-375`; table `receiving-delivery.tsx:1495-1573` | reads bags | actions `Taisyti`/`Anuliuoti` only when PENDING; `Spausdinti` always for ACTIVE | source |
| **RCV-PHYS-06** Correct package (packaging/gross/location) | `Taisyti` → `PATCH /batches/:id/bags/:bagId` | `receiving-delivery.tsx:470-519,1575-1660`; `batches.service.ts:1140-1248` | updates `bags`; appends `bag_corrections` (`PACKAGING`, `GROSS_WEIGHT`, `LOCATION`) only for effective changes | PENDING only; ACTIVE only; gross > tare; no-op records nothing | source; e2e "corrects a package gross weight and packaging with an auditable trail", "treats a no-op correction as unchanged…" |
| **RCV-PHYS-07** Void package | `Anuliuoti` → `POST /batches/:id/bags/:bagId/void` | `receiving-delivery.tsx:521-549,1662-1702`; `batches.service.ts:1255-1288` | `bags.status=VOIDED`, `voided_by_id`, `voided_at`, `void_reason`; `bag_corrections` VOID row | PENDING only; never deleted; excluded from totals | source; e2e "voids a package: preserved and excluded from the measured weight" |
| **RCV-PHYS-08** Voided package list + correction history | operational screen (`Anuliuotos pakuotės`); ADMIN batch detail (`Pataisymų istorija`) | `voidedBatchUnits` `receiving.ts:378-380`; `receiving-delivery.tsx:1704-1746`; `batch-details-page.tsx:1160-1201` | reads bags + corrections | correction history newest first; voided rows muted | source |
| **RCV-PHYS-09** Suggested packaging + location for the next package | after each save/reload | `initialUnitDraft` `receiving.ts:410-422`; server `get()` `batches.service.ts:1038-1045` | reads latest ACTIVE bag | PIECE suggests location from latest item, packaging from latest bag only | source; e2e "suggests the packaging type of the latest active package, not a voided one" |
| **RCV-PHYS-10** Barcode lookup (`GET /bags/by-barcode/:barcode`) | **no web caller**; tests only | `bags.controller.ts:10-18`; `batches.service.ts:1290-1302` | reads one bag | authenticated only | source; e2e "looks up a package by barcode and 404s for unknown codes"; finding F-05 |
| **RCV-PHYS-11** Server-derived batch totals (`bagCount`, `totalNetWeight`) | list, manager, detail, stock | `summariesFor` `batches.service.ts:1903-1925`; `get()` `:980-984` | reads `bags.status=ACTIVE` sum `net_weight` | voided excluded; never stored | source; e2e "reflects package add/correct/void in the delivery summary immediately" |

### 5.6 PIECE receiving (PIECE)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-PIECE-01** Item entry form (product, quantity, location) | operational screen, PIECE batch, PENDING | `receiving-delivery.tsx:1094-1183`; `pieceItemFormError` `batch-form.ts:144-156` | client-only draft; location preserved for fast repeat entry | positive integer quantity; active resource; location in batch warehouse | source |
| **RCV-PIECE-02** Create item group with its own barcode | `Išsaugoti` / `Išsaugoti ir spausdinti` → `POST /batches/:id/items` | `receiving-delivery.tsx:555-608`; `batches.service.ts:1322-1362` | inserts `batch_items`: `barcode`, `resource_id`, `warehouse_location_id`, `quantity`, `status=ACTIVE` | PENDING + PIECE; same product again creates a separate group (no merge) | source; e2e "adds several different products…", "gives each PIECE group a unique barcode…" |
| **RCV-PIECE-03** Item list, total pieces, per-group label | operational screen | table `receiving-delivery.tsx:1251-1328`; `batchTotalPieces` `receiving.ts:322-324` | reads items | total is client sum; server also derives it (F-09) | source |
| **RCV-PIECE-04** Correct item (resource/quantity/location) | `Taisyti` → `PATCH /batches/:id/items/:itemId` | `receiving-delivery.tsx:610-666,1334-1414`; `batches.service.ts:1364-1398` | updates `batch_items`; **no correction audit table** | PENDING + PIECE; barcode unchanged | source; e2e "corrects and voidly removes item lines while PENDING"; finding F-23 |
| **RCV-PIECE-05** Void item | `Anuliuoti` → `POST /batches/:id/items/:itemId/void` | `receiving-delivery.tsx:668-699,1416-1456`; `batches.service.ts:1400-1423` | `status=VOIDED`, `voided_by_id`, `voided_at`, `void_reason` | PENDING only; never deleted | source; e2e "corrects and voidly removes item lines while PENDING" |
| **RCV-PIECE-06** Voided item list | operational screen `Anuliuotos pakuotės` (items share the heading) | `voidedBatchItems` `receiving.ts:327-329`; `receiving-delivery.tsx:1458-1491` | reads items | muted rows; shows reason | source |
| **RCV-PIECE-07** Aggregate active pieces per resource | manager confirmation; discrepancy creation | `aggregateActualPieces` `batches.service.ts:2300-2325`; `pieceSummariesFor` `:1866-1887` | derived from ACTIVE items | same product across groups is summed | source; e2e "aggregates the same resource across groups and reconciles per product" |
| **RCV-PIECE-08** Resume a pending PIECE batch | re-enter `/receiving/[deliveryId]/batches/[batchId]`; `Gavimo turinys` row | `receiving-delivery.tsx:790-814`; batch URL | none; no new code/barcode | only explicit `Nauja partija` allocates a new batch | source; e2e "resumes a PENDING PIECE batch without allocating a new code" |
| **RCV-PIECE-09** Quick-create a product from receiving | `+ Nauja prekė` under the product selector | `receiving-delivery.tsx:701-735,1185-1247`; `resources.controller.ts:57-65`; `QuickCreateResourceRequestSchema` `resources.ts` | inserts `resources` (`name`, `category_id`, active) | ADMIN or WAREHOUSE_WORKER; narrower than resource admin | source; e2e "quick-creates a product from receiving (worker) but not broad resource admin" |

### 5.7 Labels and barcodes (LABEL)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-LABEL-01** Package label payload | save-and-print; reprint | `bagLabelData` `receiving.ts:120-143`; `bag-label.tsx` | derived from delivery code, batch warehouse/resource/category, bag net/gross/tare/location/barcode | shows net primary, gross/tare secondary; batch code not printed | source |
| **RCV-LABEL-02** Print trigger (browser dialog) | Save-and-print, label `Spausdinti` | auto `window.print()` after label id `receiving-delivery.tsx:305-314`; button `:1768-1776` | browser-only; no print record | 50 ms timer; printing is not reported as success | source; AGENTS.md feedback rule |
| **RCV-LABEL-03** Reprint active unit only | `Spausdinti` in the units list | `reprintUnit` `receiving-delivery.tsx:353-359`; `canPrintLabel` `entities/batch/batch.ts:79-82` | reuses the existing bag; creates nothing | VOIDED rejected by guard and disabled in ADMIN table (`batch-details-page.tsx:1134-1151`) | source |
| **RCV-LABEL-04** PIECE group label | per-group `Spausdinti`; save-and-print | `pieceLabelData` `receiving.ts:277-294`; `piece-label.tsx`; `receiving-delivery.tsx:1780-1810` | derived; barcode identifies the group, not one piece | ACTIVE only | source; e2e "gives each PIECE group a unique barcode…" |
| **RCV-LABEL-05** EAN-13-shaped barcode generation + graphic | server on bag/item create; web renders graphic | `bag-barcode.ts`; `shared/ui/ean13-barcode.tsx` | `bags.barcode`, `batch_items.barcode` unique; encodes no business data | 13 digits + check digit; 5 retries | source; e2e "generates unique, valid EAN-13 barcodes…" |

### 5.8 Documentary reconciliation / confirmation (RECON)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-RECON-01** Manager receipt screen load | `Tvirtinti`/`Peržiūrėti`; direct `/receipts/[deliveryId]` | `receipt-manager-page.tsx:185-218` | `GET /deliveries/:id` + one `GET /batches/:id` per batch (N+1) | ADMIN; 404 sets `Priėmimas nerastas.` | source |
| **RCV-RECON-02** WEIGHT confirmation (`Dokumentinis svoris, kg`, value, date, no.) | manager row `Patvirtinti PXX` → `POST /batches/:id/reconcile` | UI `receipt-manager-page.tsx:357-429,509-620`; payload `toReconcilePayload` `batch-form.ts:558-574`; server `batches.service.ts:1673-1841` | `batches.status=CONFIRMED`, `document_weight`, `acquisition_amount`, `receipt_line_id`, `confirmed_at`; optional `receiving_discrepancies`; `goods_receipts`/`goods_receipt_lines` anchor | PENDING + WEIGHT; non-empty active packages; `documentWeight > 0`; acknowledgement when `measured − document ≠ 0` | source; e2e "confirms an exact-match batch…", "requires explicit acknowledgement…", "uses the measured − document sign convention" |
| **RCV-RECON-03** PIECE confirmation, itemised per product | manager `Pagal prekes` | UI `receipt-manager-page.tsx:884-999`; payload `toConfirmPiecePayload` `batch-form.ts:347-375`; server `batches.service.ts:1498-1618` | `batches.status=CONFIRMED`, `document_pieces` (sum), `acquisition_amount`, date/number; one `piece_reconciliation_lines` row per product; one PIECE discrepancy per mismatched product | every active resource needs a document count; duplicate/unknown resource rejected; ack required on any mismatch | source; e2e "reconciles an itemised document with 9 vacuum cleaners and 11 suitcases against 10 each" |
| **RCV-RECON-04** PIECE confirmation, single aggregate total | manager `Bendras kiekis` | same, `documentPieces` branch `batches.service.ts:1498-1506` | `document_pieces` = total; **no `piece_reconciliation_lines` are written** (`lines` stays empty in this branch); one aggregate discrepancy when the total differs | default for a single-product batch (`defaultPieceDocumentaryMode` `batch-form.ts:261-265`); confirmed detail then shows aggregate only | source; e2e "confirms a PIECE batch with one aggregate documented count" |
| **RCV-RECON-05** Discrepancy acknowledgement dialog | manager; ADMIN batch detail | `receipt-manager-page.tsx:357-429,557-617`; `batch-details-page.tsx:234-334,830-894,1221-1256` | no write until confirmed; then server records discrepancy | one dialog per batch; names `PXX` and the mismatched products | source; `receipt-manager-page.tsx` |
| **RCV-RECON-06** Client required-field rules + red borders | manager expanded row | `managerInputClass` `receipt-manager-page.tsx:58-66`; `isDocumentaryWeightValid`/`isAcquisitionAmountValid`/`isPieceCountValid` `batch-form.ts:42-56`; form errors `:317-344,535-552` | client-only | mirrors server rules but is a parallel implementation (see §8, "required documentary rules") | source; ATV-074 record |
| **RCV-RECON-07** Confirmed batch read-only summary | manager, ADMIN detail | `documentedFor`/`differenceFor` `receipt-manager-page.tsx:253-301`; `batch-details-page.tsx:474-569,917-965` | reads persisted values | no re-confirmation (`BATCH_ALREADY_CONFIRMED`) | source |
| **RCV-RECON-08** Server-side GoodsReceipt anchor resolution | reconciliation (WEIGHT only) | `resolveReceiptLine` `batches.service.ts:1940-2035` | reuses linked line → compatible unlinked line → creates `goods_receipts` + line (qty = document weight, unit `KG`, `unit_price = value ÷ weight`) | a reused line is never mutated; PIECE confirmation creates **no** receipt line (F-14) | source; e2e "reuses an existing compatible, unlinked receipt line" |
| **RCV-RECON-09** Document metadata persistence/read | manager inputs; detail display | `reconcile` updates `goods_receipts` only if missing `batches.service.ts:1762-1777`; PIECE stores on `batches`; mapper fallback `batch.mapper.ts:227-233` | `goods_receipts.document_date/document_number` or `batches.document_date/document_number` | existing receipt values never overwritten | source; e2e "persists the acquisition value and formal document metadata" |
| **RCV-RECON-10** Per-batch confirmation on the ADMIN batch detail screen | `/receipts/batches/[id]` | `batch-details-page.tsx:206-334,967-1088`; same endpoints | same writes as RCV-RECON-02/03 | duplicate journey (F-01) | source |
| **RCV-RECON-11** Confirmation error contract | API consumers | `batches.service.ts` error codes; contracts `batches.ts:360-401,478-514` | none | `BATCH_NOT_FOUND`, `BATCH_EMPTY`, `BATCH_ALREADY_CONFIRMED`, `BATCH_NOT_WEIGHT`, `BATCH_NOT_PIECE`, `DISCREPANCY_NOT_ACKNOWLEDGED`, `UNKNOWN_RESOURCE`, `DUPLICATE_RESOURCE`, `MISSING_DOCUMENT_PIECES` | source; docs/batches.md:286-295 |

### 5.9 Discrepancies (DISC)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-DISC-01** Create one WEIGHT discrepancy on confirmation | WEIGHT reconcile | `batches.service.ts:1802-1815`; mapper `batch.mapper.ts:321-341` | `receiving_discrepancies`: `kind=WEIGHT` (default), `batch_id`, `supplier_id` snapshot, measured/document/signed difference, `status=OPEN` | only when difference ≠ 0; created in the same transaction as confirmation | source; e2e "confirms a mismatch once and does not create a duplicate discrepancy on retry" |
| **RCV-DISC-02** Create PIECE discrepancies per mismatched product (+ optional aggregate) | PIECE confirm | `batches.service.ts:1591-1617` | `kind=PIECE`, `resource_id`, actual/document/difference pieces; aggregate row has `resource_id=null` for total mode | 0..n rows per batch; `difference_pieces ≠ 0` only | source; e2e piece reconciliation tests |
| **RCV-DISC-03** Discrepancy register with filters | `Ataskaitos → Neatitikimai` | `discrepancies-page.tsx:41-...`; `discrepancy-list.ts:14-...`; `GET /receiving-discrepancies` | reads all discrepancies; client filter default `OPEN`, no date bound | ADMIN UI; API read is authenticated-only (F-20) | source |
| **RCV-DISC-04** Detail + server-derived balance/direction | register row | `discrepancy-details-page.tsx:85-359`; `settlementBalance` `discrepancy.mapper.ts:59-78`; direction `receiving-discrepancies.ts:69-72` | `original = abs(difference)`, `settled = Σ covered_weight_kg`, `remaining`; direction `SHORTAGE`/`OVERAGE` | PIECE rows have `null` balance (settlement not defined) | source; e2e "lists an existing discrepancy with a derived balance and direction" |
| **RCV-DISC-05** Status lifecycle and immutability | register/detail | service `receiving-discrepancies.service.ts:202-219`; enum `receiving-discrepancies.ts:9-29` | `OPEN → PARTIALLY_SETTLED → SETTLED`; `settled_at` once; original signed difference never updated | settlement never touches inventory | source; e2e "partially and then fully settles…", "never changes the immutable discrepancy or inventory…" |
| **RCV-DISC-06** Open-discrepancy flag on batch reads | batch detail (API + ADMIN screen); **not** the receipt list | `openDiscrepancyBatchIds` `batches.service.ts:1889-1901`; `toBatch.hasOpenDiscrepancy`; rendered `batch-details-page.tsx:1313-1318` | derived (any status ≠ `SETTLED`) | shown only on the direct-URL-only ADMIN batch detail and only for WEIGHT; the receipt list renders no marker (F-17/F-27) | source; `batch-list.ts` has no marker |
| **RCV-DISC-07** PIECE settlement unsupported | discrepancy detail | UI text `discrepancy-details-page.tsx:326-329`; server `PIECE_SETTLEMENT_NOT_SUPPORTED` `receiving-discrepancies.service.ts:125-131` | rejects | PIECE rows stay `OPEN` forever in the current scope | source |

### 5.10 Settlements (SETTLE)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-SETTLE-01** Record a WEIGHT settlement | discrepancy detail form `Būdas=Svoriu` | `discrepancy-details-page.tsx:330-...`; `settlement-form.ts:43-86`; service `:76-225` | inserts `discrepancy_settlements` (`type=WEIGHT`, `covered_weight_kg`, optional source batch/reference/note), updates discrepancy status | positive covered weight ≤ remaining; discrepancy must be `WEIGHT` | source; e2e "partially and then fully settles a shortened discrepancy by weight" |
| **RCV-SETTLE-02** Record a MONEY settlement | same form `Būdas=Pinigais` | `receiving-discrepancies.service.ts:86-108,184-200` | `money_amount` + `currency`; **no** money↔kg conversion; still requires `covered_weight_kg` | `sourceBatchId` forbidden for MONEY | source; e2e "settles by money without any money↔kg conversion", "rejects a replacement-goods batch on a money settlement" |
| **RCV-SETTLE-03** Over-settlement and concurrency guard | server | row lock `:110-113`; balance recompute `:133-148` | rejects `SETTLEMENT_EXCEEDS_REMAINING`, `DISCREPANCY_ALREADY_SETTLED` | transactional | source; e2e "rejects over-settlement transactionally", "prevents concurrent settlements…" |
| **RCV-SETTLE-04** Replacement-goods batch link rules | settlement form (`Papildomai gautų prekių partija`) | `discrepancy-details-page.tsx:202-205`; service `:150-182` | `source_batch_id` on WEIGHT only; must be another confirmed batch of the same supplier | original batch rejected (`SOURCE_BATCH_SAME_AS_ORIGINAL`) | source; e2e "validates an optional source batch…" |
| **RCV-SETTLE-05** Settlement history display | discrepancy detail | `discrepancy.mapper.ts:81-98,151-156`; page | reads settlements + creator | oldest first; shows amount/currency/source batch/reference/note | source |

### 5.11 Acquisition value, expenses and allocation (COST)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-COST-01** Acquisition value entry and persistence | manager confirm (both modes); ADMIN batch detail | inputs `receipt-manager-page.tsx:783-812`; `batch-details-page.tsx:997-1015,732-751`; server `reconcile`/`confirmPiece` | `batches.acquisition_amount` Decimal(14,2); non-negative, 0 valid | entered once at confirmation; no later acquisition edit endpoint | source |
| **RCV-COST-02** One shared receipt expense record (transport/customs/method) | manager `Priėmimo išlaidos`; API | `delivery-expenses.tsx:88-106`; `getDeliveryExpenses`/`updateDeliveryExpenses` `batches.service.ts:304-374` | `incoming_delivery_expenses` unique `delivery_id`; zero defaults until saved | ADMIN only | source; e2e "keeps confirmation independent of a saved draft expense record" |
| **RCV-COST-03** Preview request (no writes) | manager, debounced 250 ms | `delivery-expenses.tsx:108-151`; `previewDeliveryExpenses` `batches.service.ts:376-383`; `buildExpensePreview` `:570-675` | reads batches/expenses/ledger; returns proposed shares, allocated/unallocated, last applied | 404 ignored on preview | source; e2e "previews and applies proportional WEIGHT shares, then values confirmed stock" |
| **RCV-COST-04** Eligibility + basis (`NET_WEIGHT`/`PIECES`/`ACQUISITION`) | preview and apply | `expense-allocation.ts:46-112`; `batches.service.ts:570-640` | derived from eligible batches (quantity > 0) | mixed WEIGHT+PIECE ⇒ `ACQUISITION`; blocked if any value null or total 0 | source; e2e "switches a mixed receipt from equal to acquisition-based allocation", "blocks mixed proportional allocation…" |
| **RCV-COST-05** `Pritaikyti paskirstymą` — apply allocation + ledger ↔ RCV-COST-06 | manager button | `delivery-expenses.tsx:153-200,377-392`; `applyDeliveryExpenses` `batches.service.ts:391-502` | inserts `delivery_expense_applications` + one entry per batch (previous/new transport+customs); updates `batches.allocated_*`; upserts header | ADMIN; receipt row locked `FOR UPDATE`; blocked basis → `ACQUISITION_BASIS_UNAVAILABLE` | source; e2e apply tests |
| **RCV-COST-06** Identical re-apply is a no-op | manager `Pritaikyti paskirstymą` again | `batches.service.ts:418-438` | no ledger row, no valuation change; toast `Paskirstymas nepakitęs.` | compares header + every batch share | source; e2e "treats a zero apply with no existing record as a no-op" |
| **RCV-COST-07** Late invoice/revision updates confirmed valuation by difference | manager after confirmation | `applyDeliveryExpenses` updates confirmed batches too; stock reads new shares | only `allocated_*` changes; physical data, confirmation and discrepancies untouched | allowed after partial/full confirmation | source; e2e "applies a late invoice to a confirmed batch and revisions only change valuation" |
| **RCV-COST-08** Cent-exact split with largest remainder, transport and customs separately | allocation | `expense-allocation.ts:114-244` | integer cents; deterministic remainder order by fraction then index | equal or proportional | source; e2e "allocates to the cent with largest-remainder rounding"; unit tests `expense-allocation.test.ts` |
| **RCV-COST-09** Unallocated balance + audit display | manager preview footer | `delivery-expenses.tsx:350-375`; preview fields | reads allocation totals + last application | `Nepaskirstyta` can be non-zero when quantities are zero | source |
| **RCV-COST-10** `PUT /deliveries/:id/expenses` draft header save | **no web caller**; API only | `deliveries.controller.ts:97-105`; `updateDeliveryExpenses` `batches.service.ts:336-374` | upserts expense header without applying shares | ADMIN | source; tests use `PUT` (`batches.e2e.test.ts:613,641`); finding F-04 |
| **RCV-COST-11** Expenses block receipt deletion | list delete + API | `hasNonZeroExpenses` `batch.mapper.ts:286-289`; `deleteDelivery` `batches.service.ts:225-238` | rejects `DELIVERY_HAS_EXPENSES` | zero-amount record does not block | source; e2e "blocks deletion for non-zero expenses but allows a zero-amount record" |

### 5.12 Stock valuation and financial visibility (VAL)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-VAL-01** `Atsargos kilogramais` card | dashboard `/` | `home-page.tsx:19-52,90-...`; `stock.service.ts:17-63`; `stock-summary.ts:65-117` | sums ACTIVE `bags.net_weight` on CONFIRMED WEIGHT batches; value = acquisition + current shares once per batch | voided/unconfirmed excluded; missing cost marks incomplete | source; `stock-summary.test.ts`; e2e "previews and applies proportional WEIGHT shares, then values confirmed stock" |
| **RCV-VAL-02** `Atsargos vienetais` card | dashboard | same | sums ACTIVE `batch_items.quantity` on CONFIRMED PIECE batches; same cost rule | separate pool from kg; no per-product cost | source; docs/stock-summary.md |
| **RCV-VAL-03** Incomplete valuation marker | dashboard | `cardValue` `stock-summary.ts:41-54`; UI `*` + explanatory text `home-page.tsx:44-47,117-...` | derived flag | quantity > 0 with unknown cost; zero stock is a real zero | source; `stock-summary.test.ts` |
| **RCV-VAL-04** Financial/documentary redaction for non-admin readers | all batch reads | `batch-redaction.ts:14-45`; controllers `batches.controller.ts:64-79`, `deliveries.controller.ts:53-87` | nulls `documentWeight`, `documentPieces`, `difference`, `acquisitionAmount`, `documentDate`, `documentNumber`, PIECE document/difference | ADMIN sees full shape | source; e2e "redacts financial/documentary batch fields from warehouse workers" |
| **RCV-VAL-05** GoodsReceiptLine `unit_price` derivation | internal anchor only | `resolveReceiptLine` `batches.service.ts:1998-2019` | persists `goods_receipt_lines.quantity = documentWeight`, `unit = KG`, `unit_price = acquisition ÷ weight` | never read by receiving UI; PIECE has no such line | source; finding F-14 |

### 5.13 Measurement mode (MODE)

| ID and purpose | Entry and consumer | Implementation | Data and effects | Conditions | Evidence |
|---|---|---|---|---|---|
| **RCV-MODE-01** Mode selection in the UI | operational screen `Partijos tipas` | `receiving-delivery.tsx:206,881-896`; `BATCH_RECEIVING_MODES`/labels `batches.ts:26-34` | local state only until `POST /deliveries/:id/batches` | default `WEIGHT` (`Svorinė`) | source |
| **RCV-MODE-02** Mode persistence and default | server | `batches.service.ts:698`; schema `receiving_mode @default(WEIGHT)` | `batches.receiving_mode` enum | one mode per batch; a receipt may hold both | source |
| **RCV-MODE-03** Mode-derived UI/API branch points | everywhere | `receiving-delivery.tsx:897-916,974-976,1083-1086,1495-1498,1750-1753,1780-1783`; `receipt-manager-page.tsx:107-137,258-301,360-408,666-677,884-1002`; `batch-details-page.tsx:357,899`; `delivery-expenses.tsx:202-209,315-319`; `stock-summary.ts:84-101`; `batch-redaction.ts:39-43` | derived branches | mode is read from stored batch, never inferred from quantities | source |
| **RCV-MODE-04** Mixed-unit receipt detection | expense preview; stock split | `isMixedReceipt` `expense-allocation.ts:46-54`; `allocationBasis` `:70-78` | determines `ACQUISITION` basis + blocking | condition = both modes present **with positive quantity**; different from “several batches” | source; e2e mixed tests |
| **RCV-MODE-05** Multi-batch rules (independent of units) | receipt list, expenses, status, confirmation | `receiptRows` grouping `batch-list.ts:243-312`; expense allocation over eligible batches `expense-allocation.ts:56-67`; per-batch `Patvirtinti PXX` | receipt status and expenses span batches | several batches may be all-WEIGHT, all-PIECE or mixed | source |
| **RCV-MODE-06** Multi-product rules (independent of mixed units) | PIECE confirmation and manager display | `defaultPieceDocumentaryMode` `batch-form.ts:261-265`; `itemLineCount > 1` → `N prekės` + `Rodyti prekes` `receipt-manager-page.tsx:507-513,679-688`; per-product rows `pieceRowsOf` `:99-105` | derived | multiple products exist **only inside a PIECE batch**; one product can appear in several groups | source |
| **RCV-MODE-07** Unit ambiguity / compatibility fields | API surface | `ReconcileBatchRequest.documentPieces` `batches.ts:360-375`; persisted on WEIGHT batches `batches.service.ts:1783-1793`; `Batch.documentPieces` contract `positive()` `batches.ts:209` | stored but not rendered for WEIGHT; 0 aggregate allowed by server | WEIGHT UI never sends it | source; finding F-13/F-18 |
| **RCV-MODE-08** Documented unit assumptions in docs/contracts | documentation | `delivery-expenses.ts:3-10` (claims mixed `BY_VALUE` unavailable); `batches.ts:183-190` vs `:210-212` (difference sign) | none | contradicts implementation (F-18) | source |

## 6. API surface from the source tree

Guards: global `JwtAuthGuard` then `RolesGuard` (`app.module.ts:48-52`). All
endpoints therefore require authentication; `@Roles` adds role checks.

| Method + path | Auth | Controller/handler | Web caller | Other consumers | Notes |
|---|---|---|---|---|---|
| `GET /deliveries` | authenticated | `deliveries.controller.ts:48-51` | list | — | includes `hasNonZeroExpenses` |
| `GET /deliveries/:id` | authenticated | `:53-63` | operational screen, manager screen | — | batches redacted per actor |
| `POST /deliveries` | ADMIN, WORKER | `:65-73` | new-receipt form | tests | creates code `GYYMM-NN` |
| `POST /deliveries/:id/batches` | ADMIN, WORKER | `:75-87` | operational screen | tests | mode-aware resolve/create |
| `GET /deliveries/:id/expenses` | ADMIN | `:89-95` | expense block | tests | zero defaults |
| `PUT /deliveries/:id/expenses` | ADMIN | `:97-105` | **none** | tests | draft header without apply (F-04) |
| `POST /deliveries/:id/expenses/preview` | ADMIN | `:107-115` | expense block (debounced) | tests | no writes |
| `POST /deliveries/:id/expenses/apply` | ADMIN | `:117-127` | `Pritaikyti paskirstymą` | tests | ledger + batch shares |
| `DELETE /deliveries/:id` | ADMIN, WORKER | `:129-134` | list delete action | tests | zero batches + zero expenses |
| `GET /batches` | authenticated | `batches.controller.ts:64-71` | list (unfiltered) | discrepancy detail (`?status=CONFIRMED`) | redacted per actor |
| `GET /batches/:id` | authenticated | `:73-79` | operational screen, manager, ADMIN detail | tests | full detail (redacted) |
| `GET /batches/:id/bags` | authenticated | `:81-84` | **none** | tests | F-06 |
| `GET /batches/:id/items` | authenticated | `:86-89` | **none** | — | F-06 |
| `PATCH /batches/:id/registration` | ADMIN, WORKER | `:91-103` | batch editor | tests | shared receipt fields + relocation |
| `POST /batches/:id/items` | ADMIN, WORKER | `:105-114` | PIECE form | tests | PIECE only |
| `PATCH /batches/:id/items/:itemId` | ADMIN, WORKER | `:116-125` | PIECE correction | tests | no audit trail |
| `POST /batches/:id/items/:itemId/void` | ADMIN, WORKER | `:127-138` | PIECE void | tests | never deletes |
| `POST /batches/:id/bags` | ADMIN, WORKER | `:140-149` | package form | tests | WEIGHT only |
| `PATCH /batches/:id/bags/:bagId` | ADMIN, WORKER | `:151-161` | package correction | tests | audited |
| `POST /batches/:id/bags/:bagId/void` | ADMIN, WORKER | `:163-174` | package void | tests | audited |
| `POST /batches/:id/reconcile` | ADMIN | `:176-186` | manager + ADMIN detail | tests | WEIGHT confirmation |
| `POST /batches/:id/confirm-piece` | ADMIN | `:188-198` | manager + ADMIN detail | tests | PIECE confirmation |
| `GET /bags/by-barcode/:barcode` | authenticated | `bags.controller.ts:14-17` | **none** | tests | scanner lookup not used (F-05) |
| `GET /receipts` | authenticated | `receipts.controller.ts:28-31` | **none** | tests | legacy GoodsReceipt API (F-03) |
| `GET /receipts/:id` | authenticated | `:33-36` | **none** | tests | legacy |
| `POST /receipts` | authenticated | `:38-44` | **none** | tests | legacy manual receipt creation; no UI since ATV-038 |
| `GET /receiving-discrepancies` | authenticated | `receiving-discrepancies.controller.ts:28-31` | register | tests | ADMIN-only UI; reads open to all auth (F-20) |
| `GET /receiving-discrepancies/:id` | authenticated | `:33-38` | detail | tests | same |
| `POST /receiving-discrepancies/:id/settlements` | ADMIN | `:40-53` | settlement form | tests | WEIGHT only |
| `GET /stock/summary` | authenticated | `stock.controller.ts` | dashboard | — | valuation read model |
| `POST /resources/receiving-quick-create` | ADMIN, WORKER | `resources.controller.ts:57-65` | `+ Nauja prekė` | tests | narrow product creation |

### 6.1 Endpoints with no identified web caller (findings)

`GET /batches/:id/bags`, `GET /batches/:id/items`,
`GET /bags/by-barcode/:barcode`, `GET|POST /receipts`, `GET /receipts/:id`,
`PUT /deliveries/:id/expenses`. Each path is exercised by tests (so it is not
proven dead), except the **GET** list variants of `/batches/:id/bags` and
`/batches/:id/items` — tests only POST to those paths, so their read handlers have
no identified caller. Removal is **not** proposed here.

### 6.2 Direct-URL-only pages

| Route | Why reachable | Consequence |
|---|---|---|
| `/receipts/batches/[id]` | URL only; `batchDetailHref` exists but is referenced only by tests | duplicate confirmation journey, correction history and label preview exist only here |
| `/receipts/[deliveryId]` | linked from the list only for ADMIN | workers get the same data through `/receiving/[deliveryId]`; direct URL for a worker → 403 |
| `/receiving/[deliveryId]` | linked for any role | non-receiving roles get 403 after following the link |

## 7. Data model and effects

### 7.1 Tables in the receiving path

| Table | Key fields used by receiving | Written by | Read by |
|---|---|---|---|
| `incoming_deliveries` | `code`, `supplier_id`, `arrival_date`, `created_by_id` | create/delete/registration edit | list, screens, labels, discrepancy register |
| `incoming_delivery_expenses` | `delivery_id` (unique), `transport_amount`, `customs_amount`, `allocation_method` | apply (upsert), PUT draft, delete cascade | expense block, delete guard |
| `delivery_expense_applications` | amounts, method, `applied_by_id`, `applied_at` | apply | last-applied audit, history |
| `delivery_expense_application_entries` | `batch_id`, previous/new transport+customs | apply | audit history (no UI list yet) |
| `batches` | `code`, `delivery_id`, `receiving_mode`, `resource_id`, `warehouse_id`, `status`, `document_weight`, `document_pieces`, `acquisition_amount`, `document_date`, `document_number`, `confirmed_at`, `receipt_line_id`, `allocated_transport_amount`, `allocated_customs_amount` | resolve/create, register edit, confirm, apply | everything |
| `bags` | `barcode`, `batch_id`, `packaging_type_id`, `gross_weight`, `tare_weight_kg`, `net_weight`, `warehouse_location_id`, `status`, void fields | create/correct/void | totals, labels, correction history, valuation |
| `bag_corrections` | `bag_id`, `kind`, previous/new value, reason, author | correct/void/relocation | ADMIN batch detail history |
| `batch_items` | `barcode`, `batch_id`, `resource_id`, `warehouse_location_id`, `quantity`, `status`, void fields | create/correct/void | PIECE totals, valuation, labels |
| `receiving_discrepancies` | `kind`, `batch_id`, `resource_id`, `supplier_id`, weight/piece quantities, `status`, `settled_at` | confirm | register, detail, batch flag |
| `piece_reconciliation_lines` | `batch_id`, `resource_id`, actual/document/difference pieces | PIECE confirm | confirmed PIECE detail; per-product comparison |
| `discrepancy_settlements` | `discrepancy_id`, `type`, `covered_weight_kg`, money, `source_batch_id`, reference, note | settlement form | detail history, balance |
| `goods_receipts` | `partner_id`, `document_date`, `document_number` | WEIGHT reconcile anchor | document metadata fallback |
| `goods_receipt_lines` | `goods_receipt_id`, `resource_id`, `warehouse_id`, `quantity`, `unit`, `unit_price` | WEIGHT reconcile anchor | not read by receiving UI |
| `packaging_types` | `name`, `tare_weight_kg`, `active` | packaging admin | package entry/correction, labels |
| `warehouse_locations` / `warehouses` / `resources` / `business_partners` | selection validity | their own modules | receiving validation and display |

### 7.2 Status changes

| Entity | From → to | Trigger | Reversible |
|---|---|---|---|
| `batches.status` | `PENDING → CONFIRMED` | `POST /batches/:id/reconcile` or `/confirm-piece` | **no** |
| `bags.status` | `ACTIVE → VOIDED` | `POST /batches/:id/bags/:bagId/void` | no |
| `batch_items.status` | `ACTIVE → VOIDED` | `POST /batches/:id/items/:itemId/void` | no |
| `receiving_discrepancies.status` | `OPEN → PARTIALLY_SETTLED → SETTLED` | settlement append | no (append-only) |
| receipt status | derived, never stored | batch statuses | — |

## 8. Calculation register

| Value | Calculated in | Persisted | Displayed | Parallel implementation |
|---|---|---|---|---|
| `netWeight = gross − tare` | server `createBag`/`correctBag`; client preview `netWeightOf` | `bags.net_weight`, `bags.tare_weight_kg` snapshot | entry form, units list, labels, stock | **yes** (client preview vs server) |
| `bagCount`, `totalNetWeight` | server `summariesFor`/`get` | no | list, manager, detail, stock | no |
| `itemLineCount`, `totalPieces` | server `pieceSummariesFor`/`get`; web `batchTotalPieces` | no | manager, detail, discrepancy | **yes** |
| actual pieces per resource | server `aggregateActualPieces`, `confirmPiece` | `piece_reconciliation_lines.actual_pieces` after confirm | manager, detail, discrepancy | **yes** (pre/post confirmation) |
| receipt status | web `receiptRows`; server `pendingBatchCount`; web `allConfirmed` | no | list, manager, operational | **yes** |
| weight difference | server `toBatch.difference`; web `formatWeightDifference`; web `differenceFor`; web `liveDifference` | `receiving_discrepancies.difference_weight` only | manager, ADMIN detail, register | **yes** (4 places; web uses JS numbers) |
| weight equality | server `difference.isZero()`; web `weightsMatch` (Number) | no | confirmation decision | **yes** |
| piece difference | server `actual − document`; web `pieceRowDifference`, `pieceConfirmationDifference`, `differenceFor` | `piece_reconciliation_lines.difference_pieces`, discrepancy `difference_pieces` | manager, ADMIN detail, register | **yes** |
| required documentary rules | server Zod + service; web `isDocumentaryWeightValid`, `isAcquisitionAmountValid`, `isPieceCountValid` | no | manager borders/messages | **yes** |
| allocation basis | server `allocationBasis`/`proportionalEligibility` | `allocation_method` on header/application | manager select/explanation | label text derived in web from `preview.basis` |
| per-batch expense share | server `allocateExpenses` (integer cents, largest remainder) | `batches.allocated_*`; ledger entries | manager preview, stock value | preview and apply share one function |
| allocated / unallocated totals | server `buildExpensePreview` | header amounts | manager footer | no |
| stock quantity | server aggregate | no | dashboard | no |
| stock value | server `summarizeStock` | inputs persisted per batch | dashboard | no |
| discrepancy balance/direction | server `settlementBalance`, `discrepancyDirection` | no (derived) | register/detail | client shows server values |
| delivery code | server | `incoming_deliveries.code` | list, labels, headings | no |
| batch code | server | `batches.code` | headings, actions | no |
| barcode | server | `bags.barcode`, `batch_items.barcode` | labels, lists | no |

## 9. Findings

Each finding states what was searched, the evidence, and what remains uncertain.
"No web caller" is never proof of safety.

### F-01 `DUPLICATE_JOURNEY` — two confirmation screens

- **Searched:** all routes rendering `POST /batches/:id/reconcile` /
  `/confirm-piece`.
- **Evidence:** `/receipts/[deliveryId]` (`receipt-manager-page.tsx`) and
  `/receipts/batches/[id]` (`batch-details-page.tsx:206-334,967-1088`) both
  implement WEIGHT and PIECE confirmation, acknowledgement dialogs and
  type-specific forms. The second screen has no inbound link.
- **Impact:** two UIs to change, two sets of default drafts and two places where
  the client-side rules must stay in sync; different visible defaults
  (`defaultPieceDocumentaryMode` is applied in both, but the surrounding layout
  and confirmed-state rendering differ).
- **Uncertain:** whether the batch-detail screen is an intentional fallback for
  deep links or leftover.

### F-02 `NO_CALLER` — ADMIN batch detail page is unreachable from the UI

- **Searched:** every `href`, `router.push`, navigation entry and `batchDetailHref`
  reference in `apps/web/src`.
- **Evidence:** `batchDetailHref` (`batch-list.ts:417-420`) is imported only by
  `batch-list.test.ts`; the route file `app/receipts/batches/[id]/page.tsx` exists
  and renders `BatchDetailsPage`. No `Link`/`push` targets it.
- **Impact:** the only place showing `Pataisymų istorija` and the ADMIN label
  preview is not discoverable; the correction trail is effectively invisible.
- **Uncertain:** intentional deep link for support or legacy.

### F-03 `LEGACY_PATH` / `NO_CALLER` — GoodsReceipt API without UI

- **Searched:** `apiFetch` calls in web; `ReceiptsModule` in `AppModule`.
- **Evidence:** no web caller for `/receipts`; `receipts.e2e.test.ts` still tests
  list/create. `GoodsReceipt`/`GoodsReceiptLine` are still created internally by
  WEIGHT reconciliation (`resolveReceiptLine`).
- **Impact:** two receipt concepts in the codebase (`IncomingDelivery` = user
  receipt, `GoodsReceipt` = formal anchor). Removing the API endpoints would not
  remove the model.
- **Uncertain:** whether the endpoints serve any external/manual use.

### F-04 `NO_CALLER` — `PUT /deliveries/:id/expenses`

- **Searched:** all web `apiFetch` uses of `/expenses`.
- **Evidence:** web uses GET, `POST /preview`, `POST /apply` only
  (`delivery-expenses.tsx:92,120,178`); `PUT` is used by e2e tests
  (`batches.e2e.test.ts:613,641`).
- **Impact:** a draft expense header can exist without applied shares; this is the
  path that makes "saved but unapplied expenses" possible and therefore blocks
  receipt deletion. Explains historical rows with expenses but `allocated_* = null`.
- **Uncertain:** whether any script/operator uses it.

### F-05 `NO_CALLER` — barcode scanner lookup

- **Searched:** `by-barcode` in web and API.
- **Evidence:** only `bags.controller.ts` and tests. Labels print barcodes but
  nothing scans them.
- **Impact:** the endpoint is a confirmed future direction (scan-driven
  movements are out of scope) but currently unused by any product flow.
- **Uncertain:** none about usage; future intent is documented as out of scope.

### F-06 `NO_CALLER` — list endpoints for bags/items

- **Searched:** `apiFetch` for `/bags` and `/items` list shapes.
- **Evidence:** web only POSTs/PATCHes/voids; detail data comes from
  `GET /batches/:id`.
- **Impact:** dead read surface, potential data-exposure surface.
- **Uncertain:** no GET caller was found in web or tests (tests POST to the same
  two paths); whether an external client reads these lists is unknown.

### F-07 `LEGACY_PATH` — dead web helpers kept alive by tests

- **Searched:** imports of `filterBatches`, `statusesForFilter`,
  `batchDetailHref`.
- **Evidence:** only `batch-list.test.ts` imports them; the production list uses
  `receiptRows`. `parseBatchListFilters` still maps the legacy
  `NEEDS_CONFIRMATION` status value.
- **Impact:** tests protect behaviour no user can reach; a future redesign can
  drop them together with the persisted key migration.
- **Uncertain:** whether old `sessionStorage` values still exist for real users.

### F-08 `PARALLEL_CALC` — weight difference computed four times

- **Searched:** `difference`, `formatWeightDifference`, `liveDifference`.
- **Evidence:** server `toBatch` (Decimal), `formatWeightDifference` (web Number),
  `receipt-manager-page.differenceFor` and `batch-details-page.liveDifference`
  (web Number). Equality is also duplicated (`difference.isZero()` vs
  `weightsMatch`).
- **Impact:** display and confirmation decision can diverge at extreme values or
  rounding edges; the canonical value is only persisted in discrepancies.
- **Uncertain:** whether 3-decimal strings can produce a client/server mismatch in
  practice (not exercised live).

### F-09 `PARALLEL_CALC` — piece totals computed in several layers

- **Searched:** `totalPieces`, `batchTotalPieces`, `actualPieces`.
- **Evidence:** web `batchTotalPieces`, server `get`, `pieceSummariesFor`,
  `aggregateActualPieces`, `confirmPiece`, and persisted
  `piece_reconciliation_lines.actual_pieces`.
- **Impact:** pre-confirmation totals and post-confirmation snapshots can drift if
  items change between load and confirm (server guard holds, UI may be stale).
- **Uncertain:** no live reproduction.

### F-10 `PARALLEL_CALC` — client net-weight preview vs server snapshot

- **Evidence:** `netWeightOf` (`receiving-delivery.tsx:157-167`) uses JS numbers;
  server uses Prisma Decimal (`batches.service.ts:1094-1113`).
- **Impact:** preview is informational only; the persisted value is authoritative.
  A preview could differ by floating-point rounding at 3 decimals.
- **Uncertain:** cosmetic only in practice; not measured.

### F-11 `PARALLEL_CALC` — receipt status derived three ways

- **Evidence:** `receiptRows` (list), `pendingBatchCount` (API), `allConfirmed`
  (operational screen). None is stored.
- **Impact:** an all-confirmed receipt is "gone" from the default queue and
  read-only on the operational screen only if the client recomputes it correctly;
  a stale client after a confirmation elsewhere can still show the form (server
  rejects writes).
- **Uncertain:** refresh behaviour across two open tabs not exercised live.

### F-12 `DOC_DRIFT` — discrepancy uniqueness claim

- **Evidence:** `docs/batches.md:383` says `batchId` is unique ("one discrepancy per
  confirmed batch"); `packages/contracts/src/receiving-discrepancies.ts:96-101`
  says "tied one-to-one to a confirmed batch". The schema has **no** unique
  constraint on `receiving_discrepancies.batch_id`
  (`schema.prisma:650-682`), and PIECE confirmation intentionally creates 0..n
  rows per batch (`batches.service.ts:1591-1617`).
- **Impact:** retry safety relies on the conditional `updateMany`, not the
  database. Anyone trusting the docs may assume a constraint that does not exist.
- **Uncertain:** none about the schema; whether the aggregate PIECE row and
  per-product rows could ever coexist is resolved by the code — they cannot,
  because `TOTAL` mode writes no per-product discrepancy and `ITEMISED` mode
  writes no aggregate one.

### F-13 `LEGACY_PATH` — `documentPieces` accepted for WEIGHT batches

- **Evidence:** `ReconcileBatchRequestSchema.documentPieces` (`batches.ts:360-375`),
  stored on the batch (`batches.service.ts:1783-1793`), returned in
  `BatchReconciliation`; no WEIGHT UI sends or renders it (grep: only PIECE forms).
- **Impact:** an API-only documentary field that can be present in historical
  WEIGHT batches and must not be misinterpreted as a physical unit.
- **Uncertain:** whether any external client ever sent it.

### F-14 `DATA_DEPENDENCY` — GoodsReceipt duplicate of documentary quantities

- **Evidence:** WEIGHT reconciliation writes `goods_receipt_lines.quantity =
  documentWeight`, `unit = KG`, `unit_price = acquisition ÷ weight`
  (`batches.service.ts:1998-2019`). PIECE confirmation writes no receipt line.
- **Impact:** the same documentary quantity/value exists twice for WEIGHT (batch +
  receipt line) and once for PIECE. Historical receipts must keep both readable;
  the derived `unit_price` can drift from a later acquisition correction (there is
  none today) and is never displayed.
- **Uncertain:** whether the receipt line is meant to be the accounting record
  later.

### F-15 `DOC_DRIFT` — removed `Kitas išteklius` still documented

- **Evidence:** `docs/batches.md:648` and `docs/packaging-types.md:50` describe
  `Kitas išteklius`; no such label/action exists in `apps/web/src` (grep for
  `Kitas išteklius` returns no matches). ATV-052 removed it in favour of
  `Nauja partija`.
- **Impact:** docs mislead the next implementer about how a new batch starts.

### F-16 `DOC_DRIFT` — batch editor save destination

- **Evidence:** `docs/batches.md:531-532` says `Išsaugoti pakeitimus` returns to the
  same batch detail. Code pushes the **parent receipt**
  (`receiving-delivery.tsx:801-806`).
- **Impact:** documentation of the round trip (and filter restoration) is wrong.

### F-17 `DOC_DRIFT` — `Neatitikimas` marker not in the receipt list

- **Evidence:** `docs/batches.md:398-401` says a confirmed batch with an unresolved
  discrepancy shows `Patvirtinta` + `Neatitikimas` in the `Priėmimas` list.
  `gavimai-page.tsx` renders only `receiptStatusLabel`, `confirmedBatchesLabel`
  and actions. The only open-discrepancy notice is on the **batch detail header**
  for WEIGHT batches (`batch-details-page.tsx:1313-1318`), which has no inbound
  link (F-02). PIECE discrepancies have no marker anywhere.
- **Impact:** the operator cannot see an open discrepancy from the receiving list;
  in normal navigation the flag is effectively invisible.
- **Uncertain:** whether the list marker was intentionally dropped in ATV-070 or
  lost in the receipt regrouping.

### F-18 `DOC_DRIFT` — contract comments contradict behaviour

- **Evidence:**
  - `packages/contracts/src/batches.ts:185-190` says `difference` is
    `documentWeight − totalNetWeight`; `:210-212` and the mapper (`:217-222`) use
    `totalNetWeight − documentWeight`.
  - `packages/contracts/src/delivery-expenses.ts:3-10` says mixed `BY_VALUE` is
    "deliberately unavailable"; implementation supports mixed receipts via
    `ACQUISITION` (`expense-allocation.ts:70-78`).
  - `Batch.documentPieces` is `positive()` in the read contract
    (`batches.ts:209`) while a PIECE aggregate of `0` is accepted and stored.
- **Impact:** a client generated from the contracts can mis-sign differences or
  assume 0 is invalid.

### F-19 `AUTH` — list is open, workflow routes are gated

- **Evidence:** `app/receipts/page.tsx` uses `AppShell` without roles;
  `/receiving/*` uses `RECEIVING_ROLES`; `/receipts/[deliveryId]` and
  `/receipts/batches/[id]` use `roles={["ADMIN"]}`. `gavimai-page.tsx` hides
  actions for non-receiving roles but keeps the G… link.
- **Impact:** ACCOUNTING/PRODUCTION_MANAGER can see supplier/status/count data,
  then hit `403 — Prieiga uždrausta` when opening a receipt. Server-side guards are
  unchanged (API reads authenticated only).
- **Uncertain:** whether this visibility is intentional for accounting.

### F-20 `AUTH` — discrepancy reads are not ADMIN-restricted at the API

- **Evidence:** `receiving-discrepancies.controller.ts:28-38` has no `@Roles`;
  the UI pages are ADMIN-only.
- **Impact:** any authenticated role can read supplier, batch, weight/piece and
  settlement contexts via the API. This is a deliberate "reads authenticated"
  convention elsewhere, but here the data is financially sensitive.
- **Uncertain:** whether this violates an intended policy.

### F-21 `UX` — misleading error states

- **Evidence:** list error path shows a toast only (`gavimai-page.tsx:100-104`);
  with `batches === null` the UI stays on `Kraunama…` forever (`:291-292`).
  Manager non-404 errors leave `delivery === null` and render
  `Priėmimas nerastas.` (`receipt-manager-page.tsx:176-183,435-446`).
- **Impact:** a network failure looks like a missing record or endless load.
- **Uncertain:** none.

### F-22 `UNRESOLVED` — suggested packaging type may be inactive

- **Evidence:** `get()` sets `suggestedPackagingTypeId` to the latest ACTIVE bag's
  packaging type without checking the type's `active` flag
  (`batches.service.ts:1043-1045`); the form only lists active types
  (`receiving-delivery.tsx:740-742`).
- **Impact:** if a packaging type is deactivated between packages, the controlled
  select has a value with no matching option; saving can send an inactive id and
  fail `PACKAGING_INACTIVE` even though the screen looked blank.
- **Uncertain:** not exercised live.

### F-23 `UNRESOLVED` — PIECE corrections are not audited

- **Evidence:** bags have `bag_corrections`; items only keep void metadata
  (`schema.prisma:530-557`); `correctItem` overwrites resource/quantity/location
  without any trail (`batches.service.ts:1364-1398`).
- **Impact:** a changed product or quantity inside a PIECE batch cannot be
  reconstructed from history; this matters for historical explanation after a
  redesign.
- **Uncertain:** whether business requires it.

### F-24 `UNRESOLVED` — barcode identity can outlive its meaning

- **Evidence:** a PIECE item's `barcode` is its group identity, but
  `PATCH /batches/:id/items/:itemId` allows changing `resourceId` and `quantity`
  without changing the barcode (`batches.service.ts:1373-1392`). Reprinting uses
  the current data.
- **Impact:** a printed label may describe a different product/quantity than the
  current row while the barcode still resolves to the row. Bag corrections change
  weight but keep barcode, which is arguably intended.
- **Uncertain:** whether relabeling is operationally handled; no reconciliation
  between printed labels and current data exists.

### F-25 `UNRESOLVED` — mixed-unit vs multi-batch vs multi-product are separate

- **Evidence:** mixed-unit rules only appear in expense allocation
  (`isMixedReceipt`) and the two stock cards; multi-batch rules appear in the list
  status/expenses/confirmation; multi-product rules appear only inside PIECE
  (`defaultPieceDocumentaryMode`, `N piece` display, per-product discrepancies).
  One receipt may contain several all-WEIGHT batches (multi-batch, not mixed), one
  PIECE batch with several products (multi-product, not mixed), or both modes
  (mixed).
- **Impact:** a redesign must not collapse these three conditions into a single
  "mixed" flag; they drive different branches.
- **Uncertain:** whether the business uses all three combinations in practice.

### F-26 `DATA_DEPENDENCY` — historical receipts need several generations of fields

- **Evidence:** `bags.tare_weight_kg` snapshot (ATV-044), inactive `Nežinoma tara`
  for migrated packages, migrated one-delivery-per-batch grouping, `documentPieces`
  on WEIGHT batches, batches with `allocated_* = null`, and discrepancies without
  a unique batch constraint.
- **Impact:** a redesign must keep reading these legacy shapes; see §10.
- **Uncertain:** exact historical data volume (not inspected, by design).

### F-27 `UNRESOLVED` — open-discrepancy flag is only visible on the unreachable detail

- **Evidence:** API `Batch.hasOpenDiscrepancy` (`batch.mapper.ts:223`) is consumed
  only by `batch-details-page.tsx:1313-1318` (direct-URL-only ADMIN page; WEIGHT
  only). The receipt list and the manager screen never read it.
- **Impact:** either a lost list affordance (F-17) or a flag whose only consumer is
  itself unreachable in normal navigation; PIECE discrepancies have no UI marker
  at all.

### F-28 `UNRESOLVED` — no per-batch or per-product cost allocation

- **Evidence:** acquisition is one batch-level amount; PIECE lines share it
  (`schema.prisma:684-707` comment: per-line cost deferred); stock cards separate
  kg/vnt. pools with one batch cost each.
- **Impact:** any future per-product margin or movement valuation needs a new
  model; today the batch is the cost pool.
- **Uncertain:** confirmed future direction only.

### F-29 `AUTH` / `DATA_DEPENDENCY` — `hasNonZeroExpenses` on the delivery list

- **Evidence:** `toDelivery` exposes it to every authenticated reader
  (`batch.mapper.ts:286-289`); only the list uses it, for the delete guard.
- **Impact:** a financial hint is available to roles that cannot open expenses.

## 10. Dependencies needed to read historical receipts

These fields/tables must survive any redesign or be migrated explicitly:

1. **Receipt grouping** — `incoming_deliveries` is the human receipt; migrated
   data has one delivery per historical batch, so grouping cannot be inferred.
2. **Batch identity** — delivery-local `P01..P99` plus the batch UUID; codes were
   renumbered deterministically, so codes alone are not historical keys.
3. **Physical quantity** — `bags.gross_weight`, `bags.tare_weight_kg` snapshot,
   `bags.net_weight`, `bags.status`, `bags.warehouse_location_id`; migrated
   packages sit on inactive `Nežinoma tara` with tare `0.000`.
4. **PIECE quantity** — `batch_items.resource_id`, `quantity`, `status`; no
   previous-value history.
5. **Documentary quantity/value** — `batches.document_weight`,
   `document_pieces` (including WEIGHT compatibility values),
   `acquisition_amount`, `document_date`, `document_number`,
   `confirmed_at`.
6. **Formal anchor** — `batches.receipt_line_id` → `goods_receipt_lines` →
   `goods_receipts` (`document_date`, `document_number`, derived `unit_price`).
7. **Expenses** — `incoming_delivery_expenses` (current header),
   `delivery_expense_applications` + entries (audit of every applied share), and
   `batches.allocated_transport_amount` / `allocated_customs_amount` (current
   shares used by valuation). A batch with `null` shares simply never received an
   allocation.
8. **Discrepancies** — `receiving_discrepancies` (signed weight or piece
   difference, `kind`, `resource_id`, `status`, `settled_at`) and
   `discrepancy_settlements` (`covered_weight_kg`, money, source batch). PIECE
   discrepancies have no settlement path today.
9. **PIECE reconciliation snapshot** — `piece_reconciliation_lines` (actual and
   documented per product at confirmation).
10. **Audit trail** — `bag_corrections` (packaging/tare string, gross weight,
    location, void reason, author) is the only reconstructable physical audit.

## 11. Exact commands used

```powershell
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --porcelain=v1
git diff --stat

# fingerprint (full procedure in the method document)
Get-FileHash -LiteralPath <file> -Algorithm SHA256

# live read-only observations
# web:  GET http://localhost:3011/receipts   -> shell shows "Kraunama paskyra…"
# api:  GET http://localhost:3010/deliveries -> 401 Authentication required
#       (same for /batches, /receipts, /bags/by-barcode/… ,
#        /receiving-discrepancies, /stock/summary)

# canonical check
npm run verify
```

`npm run verify` result: see §12.

## 12. Verification result

`npm run verify` (lint → db:validate → typecheck → test → build) was executed on
2026-11-19 at this baseline. **Result: PASS.**

| Stage | Result |
|---|---|
| `eslint .` | pass (no output) |
| `prisma validate` | `The schema at prisma\schema.prisma is valid` |
| typecheck (all workspaces) | pass |
| API tests (`vitest run`) | 27 files, **272 tests passed** |
| web tests | 31 files, **296 tests passed** |
| contracts tests | 15 files, **104 tests passed** |
| `nest build` / `next build` | success; 25 app routes compiled (receiving routes: `/receipts`, `/receipts/[deliveryId]`, `/receipts/batches/[id]`, `/receiving`, `/receiving/new`, `/receiving/[deliveryId]`, `/receiving/[deliveryId]/batches/[batchId]`) |

`db:test:migrate` reported: 24 migrations found, no pending migrations. The same
result was reproduced after the audit documents were written. Full logs are kept
at `%TEMP%\aitvaras-verify.log` and `%TEMP%\aitvaras-verify-final.log` on the
machine that ran them; they are generated output and are not committed.

> If a later run fails, record the failing stage and the first error verbatim
> instead of replacing this line.

## 13. Open questions (recorded, not answered)

1. Is `/receipts/batches/[id]` an intentional deep link, or can it be retired with
   its duplicate confirmation journey?
2. Should ACCOUNTING/PRODUCTION_MANAGER see `/receipts` at all, given that every
   row action is unavailable and the code link leads to 403?
3. Should discrepancy reads be ADMIN-only at the API, matching the UI?
4. Is `documentPieces` ever legitimately sent for a WEIGHT batch by any client?
5. Must PIECE corrections/voids have a previous-value audit like bags?
6. Is the `Neatitikimas` marker in the receipt list still required (docs say yes,
   code says no)?
7. Should the persisted `GoodsReceiptLine.unit_price` be used by accounting, or is
   it an internal artifact that can stop being written?
8. Can a receipt be re-opened after confirmation in the future, or is `CONFIRMED`
   permanently terminal (current behaviour)?
