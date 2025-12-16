# Fitlog - Ürün Gereksinimleri Dokümanı (PRD)

## 1. Giriş

**Projenin Amacı:** Fitlog, kullanıcıların fitness hedeflerine ulaşmalarını kolaylaştırmak için tasarlanmış bir mobil ve web uygulamasıdır. Kullanıcıların antrenmanlarını kaydetmelerine, ilerlemelerini takip etmelerine ve kişiselleştirilmiş antrenman programları oluşturmalarına olanak tanır.

**Hedef Kitle:**
*   Fitness'a yeni başlayanlar.
*   Deneyimli sporcular.
*   Kişisel antrenörler.
*   Belirli bir antrenman programını takip edenler.

## 2. Genel Bakış

Fitlog, kullanıcı dostu bir arayüzle kapsamlı bir antrenman takip deneyimi sunar. Kullanıcılar, yaptıkları antrenmanları, setleri, tekrarları ve kullandıkları ağırlıkları kolayca kaydedebilirler. Uygulama aynı zamanda kullanıcıların kendi antrenman programlarını oluşturmalarına veya mevcut programları kullanmalarına olanak tanır.

## 3. Kullanıcı Profilleri

*   **Aslı (Yeni Başlayan):** 25 yaşında, haftada 2-3 gün spor salonuna gidiyor. Hangi hareketleri yapması gerektiğini ve gelişimini nasıl takip edeceğini bilmiyor. Hazır antrenman programlarına ve ilerlemesini gösteren basit grafiklere ihtiyaç duyuyor.
*   **Barış (Deneyimli Sporcu):** 32 yaşında, 5 yıldır düzenli olarak vücut geliştirme ile ilgileniyor. Kendi antrenman programını uyguluyor ve her antrenmanındaki performansını detaylı olarak (ağırlık, set, tekrar) kaydetmek istiyor. Gelişimini uzun vadede analiz etmek için detaylı istatistiklere ve grafiklere önem veriyor.
*   **Canan (Kişisel Antrenör):** 40 yaşında, danışanları için özel antrenman programları hazırlıyor. Danışanlarının antrenman performansını uzaktan takip etmek ve onlara geri bildirimde bulunmak için bir platforma ihtiyaç duyuyor.

## 4. Özellikler

### 4.1. Antrenman Kaydı (Active Workout)
*   Kullanıcılar devam eden bir antrenmanı başlatabilir.
*   Antrenman sırasında yapılan egzersizler, setler, tekrarlar ve ağırlıklar kaydedilebilir.
*   Her set arasında dinlenme süreleri için zamanlayıcı bulunur.
*   Antrenmana notlar ve fotoğraflar/videolar eklenebilir.
*   Tamamlanan antrenmanlar "Logbook" (Kayıt Defteri) bölümüne kaydedilir.

### 4.2. Antrenman Programları (Training Center)
*   Kullanıcılar kendi antrenman programlarını (rutinlerini) oluşturabilir.
*   Programlar farklı kategorilere (örn: Tüm Vücut, Bacak Günü, Kardiyo) ayrılabilir.
*   Uygulama içinde hazır antrenman programları sunulur.
*   Kullanıcılar mevcut programları düzenleyebilir veya silebilir.

### 4.3. Kayıt Defteri (Logbook)
*   Geçmişte yapılan tüm antrenmanların listesi görüntülenir.
*   Kullanıcılar belirli bir antrenman kaydının detaylarını (egzersizler, setler, notlar vb.) görebilir.
*   Geçmiş antrenmanlar üzerinde arama ve filtreleme yapılabilir.

### 4.4. Ayarlar (Settings)
*   Kullanıcı verilerini (kayıtlar ve egzersizler) JSON formatında dışa aktarma (yedekleme).
*   Dışa aktarılan JSON dosyasını içe aktararak verileri geri yükleme.
*   Uygulama ile ilgili diğer ayarlar (örn: tema, bildirimler).

### 4.5. Kimlik Doğrulama (Authentication)
*   Kullanıcıların bir hesap oluşturarak verilerini bulutta güvenli bir şekilde saklaması.
*   Farklı cihazlardan kendi hesaplarına giriş yapabilme.

## 5. Teknik Gereksinimler

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS
*   **Backend & Veritabanı:** Firebase (Firestore, Authentication)
*   **Platform:** Web (ve potansiyel olarak mobil uyumlu)

## 6. Gelecek Geliştirmeleri

*   **Detaylı İstatistikler ve Grafikler:** Egzersiz bazında ve toplam antrenman hacmi için ilerleme grafikleri.
*   **Sosyal Özellikler:** Arkadaş ekleme, antrenmanları paylaşma, liderlik tabloları.
*   **Giyilebilir Cihaz Entegrasyonu:** Apple Watch, Google Fit gibi cihazlarla entegrasyon.
*   **Beslenme Takibi:** Kalori ve makro besin takibi özelliği.
*   **Kişisel Antrenör Platformu:** Antrenörlerin danışanlarını yönetebileceği özel bir arayüz.
