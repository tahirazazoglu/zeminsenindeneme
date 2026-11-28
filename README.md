# Zemin Senin

Üniversite tesisi rezervasyonu ve rezervasyona bağlı Kampüs Ağı için kapalı pilot.
Öğrenciler iOS ve Android uygulamasını, tesis görevlileri web panelini kullanır.
Pilot tesisleri, hesapları ve cüzdanı örnek verilerle çalışır.

| Dizin | Sorumluluk |
|---|---|
| `apps/mobile` | Expo öğrenci uygulaması |
| `apps/staff` | Next.js görevli paneli |
| `packages/pilot` | Ortak istemci, işlem tipleri ve biçimlendirme |
| `supabase` | Auth, veritabanı şeması, işlem fonksiyonları ve zamanlanmış mutabakat |
| `zemin-senin-mobil-platformu` | İlk gösterim için hazırlanan referans demo |

## Yerel kurulum

Docker, Node 24 ve npm gerekir. Yerel Supabase pilotu ayrı proje kimliğiyle 55321–55324 portlarını kullanır.

```sh
npm ci
npm run db:start
npm run db:seed
npm run staff -- --hostname 127.0.0.1
```

Panel [localhost:3100](http://localhost:3100) adresindedir. Mobil uygulamayı ayrı bir terminalden başlatın.

```sh
npm run mobile
```

Expo terminalinde iOS için `i`, Android için `a` ve web önizlemesi için `w` kullanılır. iOS simülatörü ve aynı bilgisayardaki web istemcisi, seed ile oluşturulan varsayılan API adresini kullanabilir. Android emülatörü için `apps/mobile/.env.local` içinde API adresini `http://10.0.2.2:55321` olarak ayarlayın. Fiziksel cihazdaki yerel test için erişilebilir bir test API adresi gerekir. Dahili pilot derlemelerinde pilot ortamının HTTPS API adresini kullanın.

Yerel öğrenci hesapları `ogrenci1@example.com` ve `ogrenci2@example.com`, görevli hesabı `gorevli@example.com`. Ekrandan giriş kodu isteyin ve kodu [yerel Mailpit](http://127.0.0.1:55324) üzerinden alın. Öğrenciler 1.000 TL test bakiyesiyle başlar. Görevli halı sahaya atanmıştır.

`db:seed` test hesaplarını, tesisleri ve yaklaşan örnek saatleri sağlar. Var olan bakiye ve kuralları sıfırlamaz. Eksik istemci ortam dosyalarını oluşturur. İstemciye yalnız yayımlanabilir Supabase anahtarı verilir.

## Pilot davranışı

- Görevli tesis bazında saatleri açıp kapatır, rezervasyon penceresi, saatlik fiyat ve iptal süresini belirler. Mevcut rezervasyonlar fiyatı ve iptal süresini saklar.
- Öğrenci bir saatlik dilimi alır ve test ücreti düşer. Sunucu fiyat değişmişse yeni fiyat için tekrar onay ister. Uygun iptal dilimi tekrar açar, rezervasyon ücretini ve bağlı başvuru blokelerini iade eder.
- Her rezervasyondan bir ilan açılır. Başvuru tutarı en az 5 TL’dir. Başvuru reddedilirse bloke kalkar. Kabul kontenjan ayırır ve tutar başlangıca kadar blokede kalır. Dakikalık görev, kabul edilen tutarı 5 TL test hizmet bedeli ve ilan sahibinin payı olarak kaydeder. Kararsız başvuruları iade eder.
- Arka uç, kapalı pilotun yazma işlemlerini tek işlem kilidiyle sıralar. Böylece kontenjan, bakiye ve iptal birbiriyle yarıştığında tutarlı kalır. Pilot yükü arttığında kilit kapsamı performans ölçümlerine göre yeniden ele alınabilir.

## Kontrol ve dağıtım

```sh
npm run typecheck
npm run db:test
npm run db:test-api
npm run build -w @zemin/staff
cd apps/mobile
npx expo export --platform all
```

HTTP testi yerel test hesapları, Mailpit ve Supabase API üzerinden çalışır. Test sonunda bakiyeler iade edilir ve test saati kapatılır.

Veritabanı testi geçici bir yerel veritabanı kullanır. Eşzamanlı rezervasyon ve kontenjanı, yetkileri, iade ve mutabakatı kontrol eder. Supabase dışında yerel PostgreSQL kullanılıyorsa `PILOT_DB_URL` ile geçici veritabanı açma yetkisi olan yerel bağlantı verilebilir.

Davetli pilot için ayrı bir Supabase projesine migration’ları uygulayın. Kayıt açmayı kapalı tutun ve Magic Link e-posta şablonunda `{{ .Token }}` kullanın ve mobil giriş için e-posta kodunu 6 hane olarak ayarlayın. Yetkili operatör Auth yönetiminden e-posta hesabını oluşturur, UUID ile `pilot.profiles` kaydını ekler ve görevliye `pilot.staff_facilities` üzerinden tesis atar. Test öğrencisine `initial_credit` cüzdan hareketiyle pilot bakiyesi tanımlanır. Pilot projesinde tesis ve saat verileri yönetim yetkisiyle ayrı oluşturulur. `db:seed` yalnızca yerel ortamı kabul eder. Panel ve mobil uygulamanın `.env.example` dosyaları gerekli istemci ayarlarını gösterir.

Dahili mobil dağıtım için ekip Expo projesini kendi hesabına bağlar, iOS imzalama ve Android dağıtım bilgilerini tanımlar, ardından `apps/mobile` dizininden `eas build --profile preview --platform all` çalıştırır. Pilot veritabanının günlüklerinde hata türü ve zaman bilgisi izlenir. Oturum belirteci veya e-posta adresi uygulama günlüklerine yazılmaz.
