/* =========================================
   JavaScript: トグルボタンによる一括制御
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    // ページ内の全てのチェックボックス要素を取得
    const controlCheckboxes = document.querySelectorAll('.control-panel input[type="checkbox"]');
    
    // 全てのチェックボックスに対してイベントリスナーを設定
    controlCheckboxes.forEach(checkbox => {
        
        // --- イベントリスナーの定義 ---
        checkbox.addEventListener('change', (event) => {
            // 制御対象のSVG IDリストを 'data-target-id' 属性から取得し、カンマで分割
            const targetIds = event.target.dataset.targetId.split(',');
            
            // チェックが入っているか (表示状態か) を判定
            const isChecked = event.target.checked;
            
            targetIds.forEach(id => {
                // IDの前後にある不要な空白文字を削除し、対応するSVG要素を取得
                const targetElement = document.getElementById(id.trim());
                
                if (targetElement) {
                    if (isChecked) {
                        // チェックあり -> 表示 (is-hidden クラスを削除)
                        targetElement.classList.remove('is-hidden');
                    } else {
                        // チェックなし -> 非表示 (is-hidden クラスを付与)
                        targetElement.classList.add('is-hidden');
                    }
                } else {
                    // IDが見つからない場合はコンソールに警告を表示（デバッグ用）
                    console.warn(`SVG要素が見つかりません: ID=${id.trim()}`);
                }
            });
        });
        
        // --- 初期状態の反映 ---
        // ページロード時に、チェックボックスの初期状態（今回の場合は全て 'checked'）
        // をSVG要素に反映させるために、意図的に 'change' イベントを発火させる
        checkbox.dispatchEvent(new Event('change'));
    });
});