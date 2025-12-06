/*
 * @Author: DESKTOP-KC6M5LK\Administrator yu_qiushui@163.com
 * @Date: 2025-12-06 14:55:26
 * @LastEditors: DESKTOP-KC6M5LK\Administrator yu_qiushui@163.com
 * @LastEditTime: 2025-12-06 16:35:42
 * @FilePath: \mydoc\game\coin.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
let total_box = []
let active_box = []
let box_total = 9
let random = 5 // 随机发的数量
let box_lock_position = 3 // 初始锁几个盒子
let open_lock_position = 3 // 盒子里金币可能值
let coin_value_origin  = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// 生成盒子
function generateBox() {
    for (let index = 0; index < box_total; index++) {
        let item = {
            position: index +  1,
            isLock: index > box_lock_position,
            children: []
        }
        total_box.push(item)
        if (index <= box_lock_position) {
            active_box.push(item)
        }
        
    }
}

// 分发金币金币、主动发、手动发
function generateCoin(params) {
    // let total_box = generateBox()
    let child_value =  coin_value_origin.slice(0, open_lock_position)

    // 对于未锁的盒子分发金币
    active_box = active_box.map(item => {
        let arr = randomCoinNum()
        console.log('randomCoinNum()===', arr, item);
        
        item.children.concat(arr)
        return item
    })

    console.log('active_box====', active_box);
    
    
    


    
}

function randomCoinNum() {
    let coinArr = []
    let child_value =  coin_value_origin.slice(0, open_lock_position)
    let coinNum = Math.floor(Math.random() * 5) + 1
    for (let index = 0; index < coinNum; index++) {
        let child_value_index = Math.floor(Math.random() * child_value.length)
        console.log('child_value_index==', child_value_index);
        
        coinArr.push(child_value[child_value_index])    
    }
    console.log('coinArr===', coinArr, child_value);
    
    return coinArr
}

// 移动金币
// 
function moveCoin(params) {
    
}

// 改变盒子是否被锁
function changeBoxStatus(params) {
    
}

// 校验盒子是否满了
/**
 * 1、盒子状态，盒子里金币数量
 * @param {*} params 
 */
function validateBoxIsFull(params) {
    
}

// 手动合成金币
function mergeCoin() {

}
generateBox()
generateCoin()
// console.log('==',total_box);
// console.log('==',active_box);
