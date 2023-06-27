"use strict";
const api_url = "http://conversation.somee.com/App/";
//const api_url = "https://localhost:7218/";

var token = "";
var user = "";
var conversationId = "";
var choosenIndex = "";
var listUser = [];

function TriggerSignalR() {
    GetInfo();
    //document.getElementById("token").innerHTML;

    var connection = new signalR.HubConnectionBuilder().withUrl(`${api_url}conversationHub?user=${user}`).build();
    //Disable the send button until connection is established.
    document.getElementById("sendButton").disabled = true;

    connection.on("ReceiveMessage", function (userSend, data) {
        TriggerNotify("New message", `New message from ${userSend}`)
        if(isInactive){
            TriggerSound("soundMessage");
        }
        if (conversationId == data["conversationId"]){
            var li = document.createElement("li");
            document.getElementById("messagesList").appendChild(li);
            // We can assign user-supplied strings to an element's textContent because it
            // is not interpreted as markup. If you're assigning in any other way, you 
            // should be aware of possible script injection concerns.
            li.innerHTML = `<b>${userSend}</b>: ${data["message"]}`;

            // gọi hàm mark-read
            var promise = CallApiPost(`${api_url}api/conversation/mark-read?ConversationId=${conversationId}`, {});
            MarkReadConversation(data["conversationId"])
        }
        else{
            var index = listUser.findIndex((e)=>{
                return e["username"] == userSend
            })
            // lấy lại ds conversation để biết có tin nhắn mới chưa đọc
            if(listUser[index]["conversationId"] == "" && listUser[index]["conversation"] == null){
                var item = {
                    "active": true,
                    "name": `Private ${userSend} and ${user}`,
                    "conversationType": 0,
                    "attendance": [
                        userSend
                    ]
                }
                var promise = CallApiPost(`${api_url}api/conversation/create-private`, item);
                promise.done((res) => {
                    listUser[index]["conversationId"] = res.data.id;
                    listUser[index]["conversation"] = res.data;
                    MarkUnreadConversation(data["conversationId"]);
                })
            }
            else{
                MarkUnreadConversation(data["conversationId"]);
            }
        }
    });

    connection.on("Online", function (userSend) {
        var index = listUser.findIndex((e)=>{
            return e["username"] == userSend
        })
        if(index >= 0){
            listUser[index]["status"] = 1
            var sts_doc = $(`.status_${index}`);
            sts_doc.removeClass("logged-out");
            sts_doc.addClass("logged-in");
        }
    });
    connection.on("Offline", function (userSend) {
        var index = listUser.findIndex((e)=>{
            return e["username"] == userSend
        })
        if(index >= 0){
            listUser[index]["status"] = 0
            var sts_doc = $(`.status_${index}`);
            sts_doc.removeClass("logged-in");
            sts_doc.addClass("logged-out");
        }
    });

    connection.start({ withCredentials: false }).then(function () {
        document.getElementById("sendButton").disabled = false;
    }).catch(function (err) {
        return console.error(err.toString());
    });

    document.getElementById("sendButton").addEventListener("click", function (event) {
        var message = document.getElementById("messageInput").value;
        if (message == "" || message == null) {
            SetNotiMessage("Please input message");
            return;
        }
        else {
            var promise = CallApiPost(`${api_url}api/conversation/send`, {
                Message: message,
                ConversationId: conversationId
            });
            promise.done((res) => {
                RenderMessage([{ content: message, from: user }], true);
            }).fail((res) => {
                SetNotiMessage(res.responseText);
            })
        }
        document.getElementById("messageInput").value = "";
    });

    document.getElementById("messageInput").addEventListener("keypress", function (event) {
        if (event.key !== 'Enter') {


            return;
          }
        var message = document.getElementById("messageInput").value;
        if (message == "" || message == null) {
            SetNotiMessage("Please input message");
            return;
        }
        else {
            var promise = CallApiPost(`${api_url}api/conversation/send`, {
                Message: message,
                ConversationId: conversationId
            });
            promise.done((res) => {
                RenderMessage([{ content: message, from: user }], true);
            }).fail((res) => {
                SetNotiMessage(res.responseText);
            })
        }
        document.getElementById("messageInput").value = "";
    });
}

function login() {
    Loading(true);
    SetInfo("", "");
    SetNotiLogin("");
    RenderMessage([], false)
    var usernameLogin = document.getElementById("usernameLogin").value;
    var passLogin = document.getElementById("passwordLogin").value;

    if (usernameLogin == "" || usernameLogin == null || passLogin == "" || passLogin == null) {
        SetNotiLogin("Please input username or password");
        return;
    }

    var promise = CallApiPost(`${api_url}api/account/login`, {
        username: usernameLogin,
        password: passLogin
    });
    promise.done((res) => {
        SetInfo(usernameLogin, res.data);
        TriggerSignalR();
        GetListUser();
        $('#loginModal').modal('toggle');
    }).fail((res) => {
        SetNotiLogin(res.responseText);
    })
}

function logout() {
    Loading(true);
    var promise = CallApiGet(`${api_url}api/account/logout`);
    promise.done((res) => {
        SetInfo("", "");
        RenderListUser([]);
        RenderMessage([], false);

        document.getElementById("usernameLogin").value = "";
        document.getElementById("passwordLogin").value = "";

        $('#loginModal').modal({
            backdrop: 'static',
            keyboard: false
        });
        $('#loginModal').modal('show');
    }).fail((res) => {
        SetNotiLogin(res.responseText);
    })
}

function SetInfo(_usernameLogin, _token) {
    document.getElementById("token").innerHTML = _token;
    document.getElementById("username").innerHTML = _usernameLogin
    conversationId = "";
    choosenIndex = "";
    GetInfo();
}
function GetInfo() {
    token = document.getElementById("token").innerHTML;
    user = document.getElementById("username").innerHTML;
}
function SetNotiLogin(mess) {
    document.getElementById("notiLogin").innerHTML = mess;
    setTimeout(function () {
        document.getElementById("notiLogin").innerHTML = "";
    }, 1000);
}

function SetNotiMessage(mess) {
    document.getElementById("notiMessage").innerHTML = mess; 
    setTimeout(function () {
        document.getElementById("notiMessage").innerHTML = "";
    }, 1000);
}

function GetListUser() {
    Loading(true);
    RenderListUser([]);
    var promise = CallApiGet(`${api_url}api/account/index`);
    promise.done((res) => {
        listUser = res.data;
        RenderListUser(listUser)
    }).fail((res) => {
        SetNotiLogin(res.responseText);
    })
}

function RenderListUser(data) {
    var listUserDoc = $("#listUser");
    var row = "";
    for (var i = 0; i < data.length; i++) {
        var template = "";
        var userRead = []
        try{
            userRead = data[i]["conversation"]["userRead"]
        }
        catch{
            userRead = []
        }

        var funcStr = "";
        var labelStr = "";
        if(data[i]["conversationId"] != "" && data[i]["conversation"] != null && data[i]["conversation"]["conversationType"] == 1){
            funcStr = `ConversationGroupHandler(${i})`;
            labelStr = `<span style="color:#0000FF">[Group] conversation</span>`;
        }
        else{
            funcStr = `ConversationPrivateHandler(${i}, '${data[i].username}')`;
            var statusUser = "";
            if (data[i].status == 1){
                statusUser = `<span class="status_${i} logged-in">●</span>`;
            }
            else{
                statusUser = `<span class="status_${i} logged-out">●</span>`;
            }
            labelStr = `${data[i].name}  ${statusUser}`;
        }

        if((data[i]["conversationId"] == "" && data[i]["conversation"] == null) 
        || userRead.some((e)=>{ return e == user})) {
            template = `<tr class='index_${i}' id='list_friend_${data[i].username}' style="cursor:pointer" onclick="${funcStr}">
                <td>${i+1}</td>
                <td>${labelStr}</td>
            </tr>`;
        }
        else{
            template= `<tr class='index_${i}' id='list_friend_${data[i].username}' style="cursor:pointer" onclick="${funcStr}">
                <td>${i+1}</td>
                <td><b>${labelStr}</b></td>
            </tr>`;
        }
        row += template;
    }
    listUserDoc.html(row);
    
    for(var i = 0; i < listUser.length; i++){
        $(`.index_${i}`).removeClass("choose-index");
    }
    if(choosenIndex != null && choosenIndex >= 0){
        $(`.index_${choosenIndex}`).addClass("choose-index");
    }
}

function ConversationPrivateHandler(index, userNameTo) {
    Loading(true);
    choosenIndex = index;
    for(var i = 0; i < listUser.length; i++){
        $(`.index_${i}`).removeClass("choose-index");
    }
    $(`.index_${choosenIndex}`).addClass("choose-index");

    var item = {
        "active": true,
        "name": "Private",
        "conversationType": 0,
        "attendance": [
            userNameTo
        ]
    }
    var promise = CallApiPost(`${api_url}api/conversation/create-private`, item);
    promise.done((res) => {
        //
        Loading(true);
        var title = listUser.find(x => x.username == userNameTo)?.name
        $("#conversationName").html("Talk to: " + title);
        listUser[index]["conversationId"] = res.data.id;
        listUser[index]["conversation"] = res.data;
        var promiseMessage = CallApiGet(`${api_url}api/conversation/message-detail?conversationid=${res.data.id}&page=1&pageSize=15`);
        conversationId = res.data.id;
        promiseMessage.done((res) => {
            // gọi hàm mark-read
            var promise = CallApiPost(`${api_url}api/conversation/mark-read?ConversationId=${conversationId}`, {});
            MarkReadConversation(conversationId)
            RenderMessage(res.data, false);
        }).fail((res) => {
            conversationId = "";
            console.log(res);
        })

    }).fail((res) => {
        console.log(res);
    })
}


function ConversationGroupHandler(index) {
    Loading(true);
    choosenIndex = index;
    for(var i = 0; i < listUser.length; i++){
        $(`.index_${i}`).removeClass("choose-index");
    }
    $(`.index_${choosenIndex}`).addClass("choose-index");
    
    $("#conversationName").html("Talk to group: ");
    var promiseMessage = CallApiGet(`${api_url}api/conversation/message-detail?conversationid=${listUser[index]["conversationId"]}&page=1&pageSize=15`);
    conversationId = listUser[index]["conversationId"];
    promiseMessage.done((res) => {
        // gọi hàm mark-read
        var promise = CallApiPost(`${api_url}api/conversation/mark-read?ConversationId=${conversationId}`, {});
        MarkReadConversation(conversationId)
        RenderMessage(res.data, false);
    }).fail((res) => {
        conversationId = "";
        console.log(res);
    })

}

function RenderMessage(data, isAppend) {
    var messagesListDoc = $("#messagesList");
    var row = "";
    for (var i = 0; i < data.length; i++) {
        var name = data[i].from == user ? 'You' : data[i].from;
        var template = `<li>
            <b>${name}</b>: ${data[i].content}
        </li>`;
        row += template;
    }
    if (isAppend) {
        messagesListDoc.html(messagesListDoc.html() + row);
    }
    else {
        messagesListDoc.html(row);
    }
}

function MarkUnreadConversation(inputConversationId){
    try{
        var user_conversation = listUser.find((e)=>{return e["conversationId"] == inputConversationId});
        if(user_conversation != null){
            var index = user_conversation["conversation"]["userRead"].findIndex((e)=>{return e == user})
            user_conversation["conversation"]["userRead"].splice(index, 1);
        }
        RenderListUser(listUser);
    }
    catch{
    }
}

function MarkReadConversation(inputConversationId){
    try{
        var user_conversation = listUser.find((e)=>{return e["conversationId"] == inputConversationId});
        if(user_conversation != null && !user_conversation["conversation"]["userRead"].some((e)=>{return e == user})){
            user_conversation["conversation"]["userRead"].push(user);
        }
        RenderListUser(listUser);
    }
    catch{
    }
}

function TriggerSound(idName){
    var sound = document.getElementById(idName); 
    sound.play();
}
//////////////////////////////
function Loading(isLoading){
    if(isLoading){
        $('#section-loader').css("display", "block")
        $('#container').css("opacity", 0.5)
    }
    else{
        $('#section-loader').css("display", "none")
        $('#container').css("opacity", 1)
    }
}

function CallApiGet(url) {
    return $.ajax({
        method: "GET",
        url: url,
        contentType: 'application/json',
        beforeSend: function (xhr) { xhr.setRequestHeader('Authorization', `Bearer ${token}`); },
        statusCode: {
            401: function () {
                alert("Token expired");
                setTimeout(function () {
                    location.reload()
                }, 2000);
            },
            404: function () {
                alert("api not found")
            },
            500: function () {
                alert("Error")
            }
        }
    }).always(function() {
        Loading(false);
      })
}
function CallApiPost(url, data) {
    return $.ajax({
        method: "POST",
        url: url,
        data: JSON.stringify(data),
        contentType: 'application/json',
        beforeSend: function (xhr) { xhr.setRequestHeader('Authorization', `Bearer ${token}`); },
        statusCode: {
            401: function () {
                alert("Token expired");
                setTimeout(function () {
                    location.reload()
                }, 2000);
            },
            404: function () {
                alert("api not found")
            },
            500: function () {
                alert("Error")
            }
        }
    }).always(function() {
        Loading(false);
      })
}

function TitleChangeFunc(message){
    if (document.title != message)
    {
        document.title = message;
    }
    else
    {
        document.title = "Conversation App"
    }
}

var titleChangeInterval = null
function TriggerNotify(title, message){
    if(isInactive){
        clearInterval(titleChangeInterval);
        titleChangeInterval = setInterval(() => {
            TitleChangeFunc(message)
        }, 2000);
    }
    var icon = "./favicon.ico";
    var notification = new Notification(title, { message, icon});
}

$(document).ready(function () {
    $('#loginModal').modal({
        backdrop: 'static',
        keyboard: false
    });
    $('#loginModal').modal('show');
    //var permission = Notification.requestPermission();
});

var isInactive = false
$(window).focus(function() {
    document.title = "Conversation App";
    clearInterval(titleChangeInterval);
    isInactive = false
});

$(window).blur(function() {
    isInactive = true
});