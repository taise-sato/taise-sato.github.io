// DOM（HTML）の読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', function() {

    // 1. 必要なHTML要素を取得
    const image = document.getElementById('map-image');
    const btnSimple = document.getElementById('btn-simple');
    const btnNames = document.getElementById('btn-names');
    const btnBanner = document.getElementById('btn-banner');
    const btnFlag = document.getElementById('btn-flag');

    // すべてのボタンを配列にまとめる
    const buttons = [btnSimple, btnNames, btnBanner, btnFlag];

    // 2. 画像のパスをマッピング（対応付け）
    const imagePaths = {
        'btn-simple': 'images/simple.jpg',
        'btn-names': 'images/with_names.jpg',
        'btn-banner': 'images/banner.jpg',
        'btn-flag': 'images/flag.jpg'
    };

    // 3. 各ボタンにクリックイベントを追加
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            
            // (A) 画像を切り替える
            const newImageSrc = imagePaths[this.id]; // this.idはクリックされたボタンのID
            image.style.opacity = 0; // 一瞬透明にする（フェードアウト）

            setTimeout(() => {
                image.src = newImageSrc; // 画像のソースを更新
                image.style.opacity = 1; // フェードイン
            }, 200); // 0.2秒後に実行

            // (B) 'active' クラスを管理する
            // すべてのボタンから 'active' を削除
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // クリックされたボタンに 'active' を追加
            this.classList.add('active');
        });
    });
});
