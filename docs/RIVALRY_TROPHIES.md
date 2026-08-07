# Rivalry trophies — which schools each one belongs to

**Derived from the save, not from recall.** The `Rivalry` table carries a
`Trophy` reference alongside `Team1`/`Team2`, so for most of these the schools
are a fact read out of the file rather than something anyone had to remember.
Read from `DYNASTY-TULANEMASTER`: 233 rivalries, 91 of them carrying a trophy.

The `Trophy` reference points at tables 16443-16488, which live **outside the
save** — the same situation as the AD-goal catalogue, so the trophy's *name*
isn't reachable, only its stable catalogue id. That turns out to be enough:
every rivalry sharing an id shares a trophy, and the ids line up one-for-one
with the art files.

## Naming

    rvlt-TrophyName-CODE1-CODE2[-CODE3].webp

Schools are short codes, in the save's own `Team1`/`Team2` order so this document
and the filenames can never disagree. The codes are what let four different
`VictoryBell` files and three `GovernorsCup` files coexist unambiguously — the
old `_C_M` / `_K_KS` suffixes did the same job far less legibly.

Only `FloridaCup` has a third school.

## Heads-up: 26 files share one placeholder image

Hashing all 106 gives 80 distinct images. A single generic gold "RIVALRY TROPHY"
render is shared by **26 differently-named files**; `PurdueCannon` and
`VictoryCannon` are a second identical pair; and `DefaultRivalryTrophy` isn't a
trophy at all, just a small EA SPORTS badge. Those are flagged below — a name on
a file with no unique art is a label for something that doesn't exist yet.

---

## Renamed (90)

| File | Schools | |
|---|---|---|
| `rvlt-BattleofI75-BGSU-TOL.webp` | Bowling Green / Toledo | added by the game's 2026-08-06 patch |
| `rvlt-Bell-USM-TULN.webp` | Southern Miss / Tulane |  |
| `rvlt-Belt-USA-TROY.webp` | South Alabama / Troy |  |
| `rvlt-BenSchwartzwalder-SYR-WVU.webp` | Syracuse / West Virginia |  |
| `rvlt-BlackDiamond-VT-WVU.webp` | Virginia Tech / West Virginia |  |
| `rvlt-Bones-MEM-UAB.webp` | Memphis / UAB |  |
| `rvlt-BourbonBarrel-UK-TENN.webp` | Kentucky / Tennessee | **placeholder art** |
| `rvlt-BridgerRifle-USU-WYO.webp` | Utah State / Wyoming |  |
| `rvlt-BronzeBoot-CSU-WYO.webp` | Colorado State / Wyoming |  |
| `rvlt-BronzeStalk-BALL-NIU.webp` | Ball State / NIU |  |
| `rvlt-CentennialCup-COLO-CSU.webp` | Colorado / Colorado State |  |
| `rvlt-ChancellorsSpurs-TEX-TTU.webp` | Texas / Texas Tech | **placeholder art** |
| `rvlt-CivilConflict-CONN-UCF.webp` | UConn / UCF |  |
| `rvlt-CommanderinChiefs-AF-ARMY.webp` | Air Force / Army |  |
| `rvlt-CommonwealthCup-UVA-VT.webp` | Virginia / Virginia Tech |  |
| `rvlt-CrabBowl-MD-NAVY.webp` | Maryland / Navy |  |
| `rvlt-CyHawk-IOWA-ISU.webp` | Iowa / Iowa State |  |
| `rvlt-DickTomeyLegacy-HAW-SJSU.webp` | Hawai'i / San Jose State |  |
| `rvlt-DonShulaAward-FIU-FAU.webp` | FIU / FLA Atlantic |  |
| `rvlt-FlagshipCup-BUFF-UMASS.webp` | Buffalo / UMass |  |
| `rvlt-FloridaCup-UF-FSU-MIA.webp` | Florida / Florida State / Miami | **placeholder art** |
| `rvlt-FloydofRosedale-IOWA-MINN.webp` | Iowa / Minnesota |  |
| `rvlt-Freedom-NEB-WIS.webp` | Nebraska / Wisconsin |  |
| `rvlt-FremontCannon-NEV-UNLV.webp` | Nevada / UNLV |  |
| `rvlt-Gansz-NAVY-SMU.webp` | Navy / SMU |  |
| `rvlt-GeorgeJewitt-MICH-NW.webp` | Michigan / Northwestern |  |
| `rvlt-GoldenBoot-ARK-LSU.webp` | Arkansas / LSU |  |
| `rvlt-GoldenEgg-MISS-MSST.webp` | Ole Miss / Mississippi St |  |
| `rvlt-GoldenHat-OU-TEX.webp` | Oklahoma / Texas |  |
| `rvlt-GovernorsCup-KU-KSU.webp` | Kansas / Kansas State |  |
| `rvlt-GovernorsCup-UGA-GT.webp` | Georgia / Georgia Tech |  |
| `rvlt-GovernorsCup-UK-LOU.webp` | Kentucky / Louisville |  |
| `rvlt-GovernorsVictoryBell-MINN-PSU.webp` | Minnesota / Penn State |  |
| `rvlt-Heartland-IOWA-WIS.webp` | Iowa / Wisconsin |  |
| `rvlt-Heroes-IOWA-NEB.webp` | Iowa / Nebraska |  |
| `rvlt-Illibuck-ILL-OSU.webp` | Illinois / Ohio State |  |
| `rvlt-Ireland-BC-ND.webp` | Boston College / Notre Dame |  |
| `rvlt-IronSkillet-SMU-TCU.webp` | SMU / TCU |  |
| `rvlt-IslandShowdown-HAW-UNLV.webp` | Hawai'i / UNLV |  |
| `rvlt-JamesEFoy-ALA-AUB.webp` | Alabama / Auburn |  |
| `rvlt-KegofNails-CIN-LOU.webp` | Cincinnati / Louisville |  |
| `rvlt-KitCarsonRifle-ARIZ-UNM.webp` | Arizona / New Mexico | **placeholder art** |
| `rvlt-Kuter-AF-HAW.webp` | Air Force / Hawai'i |  |
| `rvlt-LandGrant-MSU-PSU.webp` | Michigan State / Penn State |  |
| `rvlt-LandofLincoln-ILL-NW.webp` | Illinois / Northwestern |  |
| `rvlt-Legends-ND-STAN.webp` | Notre Dame / Stanford |  |
| `rvlt-LittleBrownJug-MICH-MINN.webp` | Michigan / Minnesota |  |
| `rvlt-LonestarShowdown-TEX-TAMU.webp` | Texas / Texas A&M |  |
| `rvlt-MagnoliaBowl-LSU-MISS.webp` | LSU / Ole Miss |  |
| `rvlt-MayorsCup-MIZ-SC.webp` | Missouri / South Carolina |  |
| `rvlt-MayorsCup-RICE-SMU.webp` | Rice / SMU |  |
| `rvlt-Megaphone-MSU-ND.webp` | Michigan State / Notre Dame |  |
| `rvlt-MichiganMAC-CMU-EMU.webp` | C. Michigan / E. Michigan |  |
| `rvlt-MilkCan-BSU-FRES.webp` | Boise State / Fresno State |  |
| `rvlt-ORourkeMcFadden-BC-CLEM.webp` | Boston College / Clemson |  |
| `rvlt-OilCan-FRES-SDSU.webp` | Fresno State / San Diego St. |  |
| `rvlt-OkefenokeeOar-UF-UGA.webp` | Florida / Georgia | **placeholder art** |
| `rvlt-OlSchoolBell-TROY-JVST.webp` | Troy / Jax State | **placeholder art** |
| `rvlt-OldBrassSpittoon-IND-MSU.webp` | Indiana / Michigan State |  |
| `rvlt-OldOakenBucket-IND-PUR.webp` | Indiana / Purdue |  |
| `rvlt-OldWagonWheel-BYU-USU.webp` | BYU / Utah State | **placeholder art** |
| `rvlt-PaintBucket-ARST-MEM.webp` | Arkansas State / Memphis | **placeholder art** |
| `rvlt-Palladium-MTSU-TROY.webp` | Middle Tenn / Troy |  |
| `rvlt-PalmettoBowl-CLEM-SC.webp` | Clemson / South Carolina |  |
| `rvlt-Paniolo-HAW-WYO.webp` | Hawai'i / Wyoming |  |
| `rvlt-PaulBunyan-MICH-MSU.webp` | Michigan / Michigan State |  |
| `rvlt-PaulBunyanAxe-MINN-WIS.webp` | Minnesota / Wisconsin |  |
| `rvlt-Platypus-ORE-ORST.webp` | Oregon / Oregon State | **placeholder art** |
| `rvlt-PurdueCannon-ILL-PUR.webp` | Illinois / Purdue |  |
| `rvlt-RamFalcon-AF-CSU.webp` | Air Force / Colorado State |  |
| `rvlt-RedBirdRivalry-BALL-MOH.webp` | Ball State / Miami (OH) |  |
| `rvlt-RioGrandeRivalry-UNM-NMSU.webp` | New Mexico / New Mexico St. | **placeholder art** |
| `rvlt-RipMiller-NAVY-ND.webp` | Navy / Notre Dame |  |
| `rvlt-Saddle-TCU-TTU.webp` | TCU / Texas Tech |  |
| `rvlt-Shillelagh-ND-NW.webp` | Notre Dame / Northwestern |  |
| `rvlt-Shillelagh-ND-USC.webp` | Notre Dame / USC |  |
| `rvlt-SilverSpade-NMSU-UTEP.webp` | New Mexico St. / UTEP |  |
| `rvlt-SouthwestClassic-ARK-TAMU.webp` | Arkansas / Texas A&M |  |
| `rvlt-Telephone-ISU-MIZ.webp` | Iowa State / Missouri |  |
| `rvlt-TerritorialCup-ARIZ-ASU.webp` | Arizona / Arizona State |  |
| `rvlt-TextileBowl-CLEM-NCST.webp` | Clemson / NC State |  |
| `rvlt-TigerRag-LSU-TULN.webp` | LSU / Tulane |  |
| `rvlt-TigerSoonerPeacePipe-MIZ-OU.webp` | Missouri / Oklahoma | **placeholder art** |
| `rvlt-ValleyCup-FRES-SJSU.webp` | Fresno State / San Jose State |  |
| `rvlt-VictoryBell-CIN-MOH.webp` | Cincinnati / Miami (OH) |  |
| `rvlt-VictoryBell-MIZ-NEB.webp` | Missouri / Nebraska |  |
| `rvlt-VictoryBell-UCLA-USC.webp` | UCLA / USC |  |
| `rvlt-VictoryBell-UNC-DUKE.webp` | North Carolina / Duke |  |
| `rvlt-WagonWheel-AKR-KENT.webp` | Akron / Kent State |  |
| `rvlt-WaronI4-USF-UCF.webp` | USF / UCF |  |

---

## Left alone (17) — naming these would be a guess

All but `DefaultRivalryTrophy` ship the shared placeholder image, so there is no
artwork here to label. `VictoryCannonTrophy` is byte-identical to the Purdue
Cannon (Illinois/Purdue) and is almost certainly a duplicate name for it.

- `rvlt_BUTTBowlTrophy_Small.webp` — placeholder art
- `rvlt_DefaultRivalryTrophy_Small.webp`
- `rvlt_GoldCowbellTrophy_Small.webp` — placeholder art
- `rvlt_GoldenScrewdriverTrophy_Small.webp` — placeholder art
- `rvlt_JamesBonhamTrophy_Small.webp` — placeholder art
- `rvlt_JeffersonEppesTrophy_Small.webp` — placeholder art
- `rvlt_LamarHuntTrophy_Small.webp` — placeholder art
- `rvlt_MakalaTrophy_Small.webp` — placeholder art
- `rvlt_PaddlewheelTrophy_Small.webp` — placeholder art
- `rvlt_RivalrySeriesTrophy_Small.webp` — placeholder art
- `rvlt_SeminoleWarCanoeTrophy_Small.webp` — placeholder art
- `rvlt_TempTrophy_Small.webp` — placeholder art
- `rvlt_ThompsonCupTrophy_Small.webp` — placeholder art
- `rvlt_VictoryBarrelTrophy_Small.webp` — placeholder art
- `rvlt_VictoryCannonTrophy_Small.webp`
- `rvlt_WilliamsTrophy_Small.webp` — placeholder art
- `rvlt_WoodenBootTrophy_Small.webp` — placeholder art

---

## Trophies the save knows about with no art in the pack (8)

These rivalries carry a `Trophy` reference but no file matches them. Worth
knowing before assuming a lookup always resolves.

- Arkansas / Missouri (Battle Line Rivalry)
- Washington / Washington St. (Apple Cup)
- Houston / Rice (Bayou Bucket Classic)
- Oklahoma / Oklahoma State (Bedlam)
- California / Stanford (Big Game)
- Marshall / Ohio (Battle for the Bell)
- BYU / Utah (Holy War)
- Utah / Utah State (Battle of the Brothers)

---

## Reverse manifest

Every rename, oldest name first, in case any of this needs undoing.

```
rvlt_Bell_SM_T_Trophy_Small.webp  ->  rvlt-Bell-USM-TULN.webp
rvlt_BeltTrophy_Small.webp  ->  rvlt-Belt-USA-TROY.webp
rvlt_BenSchwartzwalderTrophy_Small.webp  ->  rvlt-BenSchwartzwalder-SYR-WVU.webp
rvlt_BlackDiamondTrophy_Small.webp  ->  rvlt-BlackDiamond-VT-WVU.webp
rvlt_BonesTrophy_Small.webp  ->  rvlt-Bones-MEM-UAB.webp
rvlt_BourbonBarrelTrophy_Small.webp  ->  rvlt-BourbonBarrel-UK-TENN.webp
rvlt_BridgerRifleTrophy_Small.webp  ->  rvlt-BridgerRifle-USU-WYO.webp
rvlt_BronzeBootTrophy_Small.webp  ->  rvlt-BronzeBoot-CSU-WYO.webp
rvlt_BronzeStalkTrophy_Small.webp  ->  rvlt-BronzeStalk-BALL-NIU.webp
rvlt_CentennialCupTrophy_Small.webp  ->  rvlt-CentennialCup-COLO-CSU.webp
rvlt_ChancellorsSpursTrophy_Small.webp  ->  rvlt-ChancellorsSpurs-TEX-TTU.webp
rvlt_CivilConflict_Small.webp  ->  rvlt-CivilConflict-CONN-UCF.webp
rvlt_CommanderinChiefs_AF_A_Trophy_Small.webp  ->  rvlt-CommanderinChiefs-AF-ARMY.webp
rvlt_CommonwealthCupTrophy_Small.webp  ->  rvlt-CommonwealthCup-UVA-VT.webp
rvlt_CrabBowlTrophy_Small.webp  ->  rvlt-CrabBowl-MD-NAVY.webp
rvlt_CyHawkTrophy_Small.webp  ->  rvlt-CyHawk-IOWA-ISU.webp
rvlt_DickTomeyLegacyTrophy_Small.webp  ->  rvlt-DickTomeyLegacy-HAW-SJSU.webp
rvlt_DonShulaAwardTrophy_Small.webp  ->  rvlt-DonShulaAward-FIU-FAU.webp
rvlt_FlagshipCupAward_Small.webp  ->  rvlt-FlagshipCup-BUFF-UMASS.webp
rvlt_FloridaCupTrophy_Small.webp  ->  rvlt-FloridaCup-UF-FSU-MIA.webp
rvlt_FloydofRosedaleTrophy_Small.webp  ->  rvlt-FloydofRosedale-IOWA-MINN.webp
rvlt_FreedomTrophy_Small.webp  ->  rvlt-Freedom-NEB-WIS.webp
rvlt_FremontCannonTrophy_Small.webp  ->  rvlt-FremontCannon-NEV-UNLV.webp
rvlt_GanszTrophy_Small.webp  ->  rvlt-Gansz-NAVY-SMU.webp
rvlt_GeorgeJewittTrophy_Small.webp  ->  rvlt-GeorgeJewitt-MICH-NW.webp
rvlt_GoldenBootTrophy_Small.webp  ->  rvlt-GoldenBoot-ARK-LSU.webp
rvlt_GoldenEggTrophy_Small.webp  ->  rvlt-GoldenEgg-MISS-MSST.webp
rvlt_GoldenHatTrophy_Small.webp  ->  rvlt-GoldenHat-OU-TEX.webp
rvlt_GovernorsCup_G_GT_Trophy_Small.webp  ->  rvlt-GovernorsCup-UGA-GT.webp
rvlt_GovernorsCup_K_KS_Trophy_Small.webp  ->  rvlt-GovernorsCup-KU-KSU.webp
rvlt_GovernorsCup_K_L_Trophy_Small.webp  ->  rvlt-GovernorsCup-UK-LOU.webp
rvlt_GovernorsVictoryBellTrophy_Small.webp  ->  rvlt-GovernorsVictoryBell-MINN-PSU.webp
rvlt_HeartlandTrophy_Small.webp  ->  rvlt-Heartland-IOWA-WIS.webp
rvlt_HeroesTrophy_Small.webp  ->  rvlt-Heroes-IOWA-NEB.webp
rvlt_IllibuckTrophy_Small.webp  ->  rvlt-Illibuck-ILL-OSU.webp
rvlt_IrelandTrophy_Small.webp  ->  rvlt-Ireland-BC-ND.webp
rvlt_IronSkilletTrophy_Small.webp  ->  rvlt-IronSkillet-SMU-TCU.webp
rvlt_IslandShowdownTrophy_Small.webp  ->  rvlt-IslandShowdown-HAW-UNLV.webp
rvlt_JamesEFoyTrophy_Small.webp  ->  rvlt-JamesEFoy-ALA-AUB.webp
rvlt_KegofNailsTrophy_Small.webp  ->  rvlt-KegofNails-CIN-LOU.webp
rvlt_KitCarsonRifleTrophy_Small.webp  ->  rvlt-KitCarsonRifle-ARIZ-UNM.webp
rvlt_KuterTrophy_Small.webp  ->  rvlt-Kuter-AF-HAW.webp
rvlt_LandGrantTrophy_Small.webp  ->  rvlt-LandGrant-MSU-PSU.webp
rvlt_LandofLincolnTrophy_Small.webp  ->  rvlt-LandofLincoln-ILL-NW.webp
rvlt_LegendsTrophy_Small.webp  ->  rvlt-Legends-ND-STAN.webp
rvlt_LittleBrownJugTrophy_Small.webp  ->  rvlt-LittleBrownJug-MICH-MINN.webp
rvlt_LonestarShowdown_Small.webp  ->  rvlt-LonestarShowdown-TEX-TAMU.webp
rvlt_MagnoliaBowlTrophy_Small.webp  ->  rvlt-MagnoliaBowl-LSU-MISS.webp
rvlt_MayorsCup_M_SC_Trophy_Small.webp  ->  rvlt-MayorsCup-MIZ-SC.webp
rvlt_MayorsCup_SMU_R_Trophy_Small.webp  ->  rvlt-MayorsCup-RICE-SMU.webp
rvlt_MegaphoneTrophy_Small.webp  ->  rvlt-Megaphone-MSU-ND.webp
rvlt_MichiganMAC_CM_EM_Trophy_Small.webp  ->  rvlt-MichiganMAC-CMU-EMU.webp
rvlt_MilkCanTrophy_Small.webp  ->  rvlt-MilkCan-BSU-FRES.webp
rvlt_ORourkeMcFaddenTrophy_Small.webp  ->  rvlt-ORourkeMcFadden-BC-CLEM.webp
rvlt_OilCanTrophy_Small.webp  ->  rvlt-OilCan-FRES-SDSU.webp
rvlt_OkefenokeeOarTrophy_Small.webp  ->  rvlt-OkefenokeeOar-UF-UGA.webp
rvlt_OlSchoolBellTrophy_Small.webp  ->  rvlt-OlSchoolBell-TROY-JVST.webp
rvlt_OldBrassSpittoonTrophy_Small.webp  ->  rvlt-OldBrassSpittoon-IND-MSU.webp
rvlt_OldOakenBucketTrophy_Small.webp  ->  rvlt-OldOakenBucket-IND-PUR.webp
rvlt_OldWagonWheelTrophy_Small.webp  ->  rvlt-OldWagonWheel-BYU-USU.webp
rvlt_PaintBucketTrophy_Small.webp  ->  rvlt-PaintBucket-ARST-MEM.webp
rvlt_PalladiumTrophy_Small.webp  ->  rvlt-Palladium-MTSU-TROY.webp
rvlt_PalmettoBowlTrophy_Small.webp  ->  rvlt-PalmettoBowl-CLEM-SC.webp
rvlt_PanioloTrophy_Small.webp  ->  rvlt-Paniolo-HAW-WYO.webp
rvlt_PaulBunyanAxeTrophy_Small.webp  ->  rvlt-PaulBunyanAxe-MINN-WIS.webp
rvlt_PaulBunyanTrophy_Small.webp  ->  rvlt-PaulBunyan-MICH-MSU.webp
rvlt_PlatypusTrophy_Small.webp  ->  rvlt-Platypus-ORE-ORST.webp
rvlt_PurdueCannonTrophy_Small.webp  ->  rvlt-PurdueCannon-ILL-PUR.webp
rvlt_RamFalconTrophy_Small.webp  ->  rvlt-RamFalcon-AF-CSU.webp
rvlt_RedBirdRivalryTrophy_Small.webp  ->  rvlt-RedBirdRivalry-BALL-MOH.webp
rvlt_RioGrandeRivalryTrophy_Small.webp  ->  rvlt-RioGrandeRivalry-UNM-NMSU.webp
rvlt_RipMillerTrophy_Small.webp  ->  rvlt-RipMiller-NAVY-ND.webp
rvlt_SaddleTrophy_Small.webp  ->  rvlt-Saddle-TCU-TTU.webp
rvlt_Shillelagh_ND_N_Trophy_Small.webp  ->  rvlt-Shillelagh-ND-NW.webp
rvlt_Shillelagh_ND_USC_Trophy_Small.webp  ->  rvlt-Shillelagh-ND-USC.webp
rvlt_SilverSpadeTrophy_Small.webp  ->  rvlt-SilverSpade-NMSU-UTEP.webp
rvlt_SouthwestClassicTrophy_Small.webp  ->  rvlt-SouthwestClassic-ARK-TAMU.webp
rvlt_TelephoneTrophy_Small.webp  ->  rvlt-Telephone-ISU-MIZ.webp
rvlt_TerritorialCupTrophy_Small.webp  ->  rvlt-TerritorialCup-ARIZ-ASU.webp
rvlt_TextileBowlTrophy_Small.webp  ->  rvlt-TextileBowl-CLEM-NCST.webp
rvlt_TigerRagTrophy_Small.webp  ->  rvlt-TigerRag-LSU-TULN.webp
rvlt_TigerSoonerPeacePipeTrophy_Small.webp  ->  rvlt-TigerSoonerPeacePipe-MIZ-OU.webp
rvlt_ValleyCupTrophy_Small.webp  ->  rvlt-ValleyCup-FRES-SJSU.webp
rvlt_VictoryBell_C_M_Trophy_Small.webp  ->  rvlt-VictoryBell-CIN-MOH.webp
rvlt_VictoryBell_NC_D_Trophy_Small.webp  ->  rvlt-VictoryBell-UNC-DUKE.webp
rvlt_VictoryBell_N_M_Trophy_Small.webp  ->  rvlt-VictoryBell-MIZ-NEB.webp
rvlt_VictoryBell_USC_UCLA_Small.webp  ->  rvlt-VictoryBell-UCLA-USC.webp
rvlt_WagonWheelTrophy_Small.webp  ->  rvlt-WagonWheel-AKR-KENT.webp
rvlt_WaronI4Trophy_Small.webp  ->  rvlt-WaronI4-USF-UCF.webp
```
