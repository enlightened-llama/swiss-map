#!/usr/bin/env python3
"""Baut data/species.json: GBIF-Taxon-Schlüssel + iNaturalist-Foto für die kuratierte Artenliste."""
import json, time, urllib.parse, urllib.request, sys, os
S = """
vogel|Eisvogel|Alcedo atthis|An ruhigen, klaren Bächen, Flüssen und Seeufern. Sitzt auf Ästen über dem Wasser – achte auf den blauen Blitz und den scharfen «tiiht»-Ruf.
vogel|Rotmilan|Milvus milvus|Über offenem Kulturland. Am tief gegabelten Schwanz sofort erkennbar.
vogel|Mäusebussard|Buteo buteo|Kreist über Feldern und Waldrändern, ruft katzenartig «hiääh». Sitzt oft auf Pfosten.
vogel|Turmfalke|Falco tinnunculus|Steht rüttelnd in der Luft über Wiesen, um Mäuse zu erspähen.
vogel|Buntspecht|Dendrocopos major|In fast jedem Wald und Park. Trommelt im Frühling kurz und schnell.
vogel|Schwarzspecht|Dryocopus martius|Grösster Specht, krähengross mit roter Kappe. In alten Buchen- und Mischwäldern.
vogel|Grünspecht|Picus viridis|Sucht am Boden nach Ameisen. Sein Ruf klingt wie lautes Lachen.
vogel|Kuckuck|Cuculus canorus|Von April bis Juni zu hören, heute vor allem in höheren Lagen und Feuchtgebieten.
vogel|Waldkauz|Strix aluco|Häufigste Eule. Das schaurige «huu-hu-huuu» hört man im Spätwinter abends im Wald.
vogel|Uhu|Bubo bubo|Grösste Eule Europas, brütet in Felswänden. In der Dämmerung tiefes «buho».
vogel|Weissstorch|Ciconia ciconia|Auf Horsten auf Dächern und Masten, sucht Futter auf feuchten Wiesen.
vogel|Graureiher|Ardea cinerea|Steht regungslos an Ufern und auf Wiesen und lauert auf Fische und Mäuse.
vogel|Haubentaucher|Podiceps cristatus|Auf Seen. Im Frühling spektakulärer Balztanz, Junge reiten auf dem Rücken der Eltern.
vogel|Wasseramsel|Cinclus cinclus|An schnell fliessenden Bächen. Knickst auf Steinen und taucht nach Insektenlarven.
vogel|Kleiber|Sitta europaea|Klettert als einziger Vogel kopfvoran den Stamm hinunter.
vogel|Rotkehlchen|Erithacus rubecula|Zutraulich, singt perlend und wehmütig – auch im Winter und in der Dämmerung.
vogel|Amsel|Turdus merula|Flötet melodiös von Dachfirsten und Baumspitzen, besonders morgens und abends.
vogel|Singdrossel|Turdus philomelos|Wiederholt jedes Gesangsmotiv zwei- bis dreimal. Schlägt Schnecken auf Steinen auf.
vogel|Kohlmeise|Parus major|Ruft im Frühling «zi-zi-bäh». Schwarzer Bauchstreif auf gelbem Grund.
vogel|Blaumeise|Cyanistes caeruleus|Turnt kopfüber an dünnen Zweigen. Blaues Käppchen.
vogel|Buchfink|Fringilla coelebs|Häufigster Vogel der Schweiz. Schmetternder Gesang mit Schlussschnörkel.
vogel|Zaunkönig|Troglodytes troglodytes|Winzig, aber unglaublich laut. Schlüpft durchs Unterholz, Schwanz steil aufgestellt.
vogel|Mönchsgrasmücke|Sylvia atricapilla|Flötender Gesang aus Gebüschen. Männchen mit schwarzer, Weibchen mit brauner Kappe.
vogel|Zilpzalp|Phylloscopus collybita|Singt seinen eigenen Namen: «zilp-zalp-zilp-zalp».
vogel|Eichelhäher|Garrulus glandarius|Der «Polizist des Waldes» warnt mit lautem Rätschen. Blaue Flügelfedern.
vogel|Mauersegler|Apus apus|Von Mai bis Juli jagen sie kreischend um Häuser. Schlafen sogar im Flug.
vogel|Feldlerche|Alauda arvensis|Singt minutenlang hoch in der Luft über Äckern und Wiesen.
vogel|Wiedehopf|Upupa epops|Selten, mit Federhaube. Vor allem im Wallis und in warmen Lagen.
vogel|Steinadler|Aquila chrysaetos|In den Alpen. Kreist an Berghängen und jagt Murmeltiere.
vogel|Bartgeier|Gypaetus barbatus|Wieder angesiedelt in den Alpen. Fast drei Meter Spannweite, frisst Knochen.
vogel|Stieglitz|Carduelis carduelis|Bunter Fink mit roter Gesichtsmaske, oft an Disteln und Karden.
vogel|Hausrotschwanz|Phoenicurus ochruros|Singt frühmorgens von Dächern, mit knirschendem Zwischenteil. Zittert mit dem roten Schwanz.
saeuger|Reh|Capreolus capreolus|In der Dämmerung an Waldrändern und auf Wiesen. Kitze im Mai/Juni nie anfassen.
saeuger|Rothirsch|Cervus elaphus|In Voralpen und Alpen. Im September/Oktober röhren die Stiere zur Brunft.
saeuger|Gämse|Rupicapra rupicapra|An steilen Hängen und Felsen, auch im Jura und in Voralpen.
saeuger|Alpensteinbock|Capra ibex|Oberhalb der Waldgrenze. Im Frühling oft tiefer unten auf den ersten grünen Wiesen.
saeuger|Alpenmurmeltier|Marmota marmota|Auf Alpweiden. Pfeift schrill bei Gefahr. Winterschlaf von Oktober bis April.
saeuger|Rotfuchs|Vulpes vulpes|Überall, auch mitten in der Stadt. Meist in der Dämmerung unterwegs.
saeuger|Dachs|Meles meles|Nachtaktiv. Tagsüber findet man seine Baue mit grossen Erdhaufen am Waldhang.
saeuger|Biber|Castor fiber|An Flüssen und Seen im Mittelland. Suche nach angenagten Bäumen und Dämmen.
saeuger|Eichhörnchen|Sciurus vulgaris|In Wäldern und Parks. Zapfenspindeln am Boden verraten den Fressplatz.
saeuger|Igel|Erinaceus europaeus|In Gärten und an Hecken, in der Dämmerung. Winterschlaf ab November.
saeuger|Feldhase|Lepus europaeus|Auf offenen Feldern, selten geworden. Viel längere Ohren als das Kaninchen.
saeuger|Wildschwein|Sus scrofa|In Laubwäldern, vor allem im Jura und Nordwesten. Aufgewühlter Boden verrät sie.
saeuger|Luchs|Lynx lynx|Sehr heimlich, in Jura und Voralpen. Man findet höchstens Spuren.
amphib|Feuersalamander|Salamandra salamandra|Bei Regenwetter in feuchten Laubwäldern mit Bächen unterwegs. Nicht anfassen (Hautgift, Pilzkrankheiten).
amphib|Bergmolch|Ichthyosaura alpestris|Im Frühling in Waldtümpeln und Weihern. Männchen mit leuchtend orangem Bauch.
amphib|Grasfrosch|Rana temporaria|Laicht schon im Februar/März in Tümpeln – grosse Laichballen.
amphib|Erdkröte|Bufo bufo|Wandert in milden Regennächten im März zu den Laichgewässern. Laichschnüre statt Ballen.
amphib|Zauneidechse|Lacerta agilis|Sonnt sich an Böschungen, Steinhaufen und Bahndämmen. Männchen im Frühling grün.
amphib|Ringelnatter|Natrix helvetica|Ungiftig, schwimmt gut. An Weihern und Flussufern. Gelbe Halbmonde am Hinterkopf.
amphib|Blindschleiche|Anguis fragilis|Keine Schlange, sondern eine beinlose Echse. Unter Brettern, Steinen, im Kompost.
insekt|Schwalbenschwanz|Papilio machaon|Grosser gelb-schwarzer Falter über blumenreichen Wiesen und Hügelkuppen.
insekt|Tagpfauenauge|Aglais io|Vier grosse «Augen» auf den Flügeln. Raupen leben an Brennnesseln.
insekt|Hirschkäfer|Lucanus cervus|Grösster Käfer Europas, an alten Eichen. Fliegt an warmen Juniabenden.
insekt|Glühwürmchen|Lampyris noctiluca|Weibchen leuchten an warmen Juni- und Juliabenden grün im Gras an Waldrändern.
insekt|Blauflügel-Prachtlibelle|Calopteryx virgo|Flattert schmetterlingsartig an sauberen, beschatteten Bächen.
pilz|Steinpilz|Boletus edulis|Bei Fichten und Buchen. Heller Stiel mit feinem weissem Netz, Röhren statt Lamellen.
pilz|Eierschwamm|Cantharellus cibarius|In moosigen Nadel- und Mischwäldern. Dottergelb, mit Leisten statt Lamellen.
pilz|Fliegenpilz|Amanita muscaria|Giftig! Unter Birken und Fichten. Wächst oft dort, wo auch Steinpilze stehen.
pilz|Speisemorchel|Morchella esculenta|Im April/Mai in Auenwäldern, unter Eschen und in Obstgärten. Roh giftig.
pilz|Parasol|Macrolepiota procera|An Waldrändern und auf Wiesen. Sehr gross, mit verschiebbarem Ring. Verwechslungsgefahr!
pilz|Maronenröhrling|Imleria badia|In Nadelwäldern. Kastanienbrauner Hut, Röhren blauen auf Druck.
pilz|Hallimasch|Armillaria mellea|Büschelweise an Stämmen und Stümpfen im Spätherbst. Roh giftig.
pflanze|Bärlauch|Allium ursinum|Bedeckt im Frühling ganze Böden feuchter Laubwälder. Knoblauchduft.
pflanze|Buschwindröschen|Anemone nemorosa|Weisse Blütenteppiche im März/April, bevor die Bäume Laub tragen. Giftig.
pflanze|Märzenbecher|Leucojum vernum|Weisse Glöckchen mit grünen Tupfen in feuchten Wäldern. Geschützt.
pflanze|Türkenbund|Lilium martagon|Prächtige rosa Lilie in Bergwäldern und Hochstauden. Geschützt.
pflanze|Frauenschuh|Cypripedium calceolus|Seltene, grosse Orchidee in lichten Wäldern auf Kalk. Streng geschützt.
pflanze|Edelweiss|Leontopodium nivale|Auf alpinen Kalkrasen über 1800 m. Geschützt – nur fotografieren.
pflanze|Stängelloser Enzian|Gentiana acaulis|Tiefblaue Trichter auf Bergwiesen im Frühsommer. Geschützt.
pflanze|Rostblättrige Alpenrose|Rhododendron ferrugineum|Färbt im Juni/Juli ganze Hänge an der Waldgrenze rot.
pflanze|Heidelbeere|Vaccinium myrtillus|Zwergstrauch in sauren Nadelwäldern und Heiden. Beeren im Juli/August.
pflanze|Alpen-Soldanelle|Soldanella alpina|Violette Fransenglöckchen direkt am schmelzenden Schnee.
"""
MONTHS = {  # beste Beobachtungsmonate
 'Kuckuck':[4,5,6],'Mauersegler':[5,6,7],'Feldlerche':[3,4,5,6,7],'Wiedehopf':[4,5,6,7,8],'Weissstorch':[3,4,5,6,7,8],
 'Waldkauz':[1,2,3,10,11,12],'Uhu':[1,2,3],'Mönchsgrasmücke':[4,5,6,7],'Zilpzalp':[3,4,5,6,7,8,9],'Singdrossel':[3,4,5,6],
 'Hausrotschwanz':[3,4,5,6,7,8,9,10],'Alpenmurmeltier':[5,6,7,8,9],'Igel':[4,5,6,7,8,9,10],'Rothirsch':[9,10],
 'Feuersalamander':[3,4,5,9,10],'Bergmolch':[3,4,5,6],'Grasfrosch':[2,3,4],'Erdkröte':[3,4],'Zauneidechse':[4,5,6,7,8,9],
 'Ringelnatter':[4,5,6,7,8,9],'Blindschleiche':[4,5,6,7,8,9],'Schwalbenschwanz':[5,6,7,8],'Tagpfauenauge':[3,4,5,7,8,9],
 'Hirschkäfer':[6,7],'Glühwürmchen':[6,7],'Blauflügel-Prachtlibelle':[5,6,7,8],'Steinpilz':[7,8,9,10],'Eierschwamm':[6,7,8,9,10],
 'Fliegenpilz':[8,9,10,11],'Speisemorchel':[4,5],'Parasol':[7,8,9,10],'Maronenröhrling':[8,9,10,11],'Hallimasch':[9,10,11],
 'Bärlauch':[3,4,5],'Buschwindröschen':[3,4],'Märzenbecher':[2,3,4],'Türkenbund':[6,7],'Frauenschuh':[5,6],'Edelweiss':[7,8,9],
 'Stängelloser Enzian':[5,6,7],'Rostblättrige Alpenrose':[6,7],'Heidelbeere':[7,8],'Alpen-Soldanelle':[4,5,6,7],
}
def get(u):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent':'species-list-builder'}), timeout=30) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(3*(i+1)); err=e
    print('FAIL',u,err,file=sys.stderr); return None
out=[]
for line in S.strip().splitlines():
    g,name,latin,tip=line.split('|')
    m=get('https://api.gbif.org/v1/species/match?name='+urllib.parse.quote(latin)) or {}
    key=m.get('speciesKey') or m.get('usageKey')
    e={'name':name,'latin':latin,'gruppe':g,'gbif':key,'tipp':tip,'monate':MONTHS.get(name,list(range(1,13)))}
    t=get('https://api.inaturalist.org/v1/taxa?rank=species&per_page=1&q='+urllib.parse.quote(latin))
    if t and t.get('results'):
        p=t['results'][0].get('default_photo') or {}
        if p.get('medium_url') and p.get('license_code'):
            e['foto']=p['medium_url']; e['fotoCredit']=p.get('attribution','')
    print(name,key,m.get('matchType'),m.get('scientificName'),'foto' if 'foto' in e else '-',file=sys.stderr)
    out.append(e); time.sleep(1.1)
json.dump(out,open(os.path.join(os.path.dirname(__file__),'..','data','species.json'),'w'),ensure_ascii=False,indent=1)
