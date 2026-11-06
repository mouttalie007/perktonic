/** 40 invented orders; the country column has 7 values, including "Côte d'Ivoire" and "N/A" (a "/" that must not become a folder). */
export const ORDERS_CSV = `order_id,order_date,customer,country,product,quantity,total_eur
A-1042,2026-10-02,Marie Curie,Germany,Wool Socks (3 pack),4,120.00
A-1043,2026-10-19,Tim Berners-Lee,France,Trail Cap,1,22.00
A-1044,2026-10-03,Ada Lovelace,France,Trail Cap,2,44.00
A-1045,2026-10-18,Grace Hopper,Germany,Merino Beanie,2,59.00
A-1046,2026-10-21,Hedy Lamarr,Spain,"Rain Jacket, ""Storm"" edition",1,129.00
A-1047,2026-10-08,Ada Lovelace,Morocco,Merino Beanie,4,118.00
A-1048,2026-10-05,Margaret Hamilton,France,Wool Socks (3 pack),3,90.00
A-1049,2026-10-27,Ibn Battuta,Spain,Trail Cap,3,66.00
A-1050,2026-10-04,Tim Berners-Lee,Morocco,Merino Beanie,2,59.00
A-1051,2026-10-07,Fatima al-Fihri,Spain,Merino Beanie,1,29.50
A-1052,2026-10-15,Tim Berners-Lee,Spain,Trail Cap,4,88.00
A-1053,2026-10-08,Hedy Lamarr,Spain,Canvas Tote,3,72.00
A-1054,2026-10-10,Fatima al-Fihri,United Kingdom,Wool Socks (3 pack),1,30.00
A-1055,2026-10-20,Hedy Lamarr,Spain,Rain Jacket,4,476.00
A-1056,2026-10-25,Alan Turing,N/A,Merino Beanie,4,118.00
A-1057,2026-10-31,Ada Lovelace,Germany,Canvas Tote,4,96.00
A-1058,2026-10-23,Tim Berners-Lee,Morocco,Trail Cap,3,66.00
A-1059,2026-10-27,Grace Hopper,Germany,Canvas Tote,4,96.00
A-1060,2026-10-22,Nikola Tesla,France,Rain Jacket,4,476.00
A-1061,2026-10-23,Hedy Lamarr,France,Rain Jacket,4,476.00
A-1062,2026-10-12,Linus Pauling,Germany,Rain Jacket,1,119.00
A-1063,2026-10-07,Ada Lovelace,France,Merino Beanie,4,118.00
A-1064,2026-10-13,Margaret Hamilton,United Kingdom,Wool Socks (3 pack),2,60.00
A-1065,2026-10-15,Alan Turing,Côte d'Ivoire,Canvas Tote,1,24.00
A-1066,2026-10-28,Margaret Hamilton,Germany,Rain Jacket,2,238.00
A-1067,2026-10-29,Marie Curie,Spain,Canvas Tote,3,72.00
A-1068,2026-10-06,Grace Hopper,Germany,Wool Socks (3 pack),2,60.00
A-1069,2026-10-27,Linus Pauling,France,Wool Socks (3 pack),1,30.00
A-1070,2026-10-05,Ada Lovelace,Spain,Rain Jacket,3,357.00
A-1071,2026-10-23,Alan Turing,Germany,Rain Jacket,3,357.00
A-1072,2026-10-29,Linus Pauling,United Kingdom,Trail Cap,1,22.00
A-1073,2026-10-13,Margaret Hamilton,United Kingdom,Trail Cap,4,88.00
A-1074,2026-10-07,Ada Lovelace,Germany,Canvas Tote,4,96.00
A-1075,2026-10-04,Alan Turing,France,Wool Socks (3 pack),4,120.00
A-1076,2026-10-19,Ada Lovelace,Germany,Merino Beanie,1,29.50
A-1077,2026-10-01,Fatima al-Fihri,France,Merino Beanie,3,88.50
A-1078,2026-10-21,Alan Turing,France,Wool Socks (3 pack),4,120.00
A-1079,2026-10-04,Linus Pauling,Germany,Rain Jacket,3,357.00
A-1080,2026-10-16,Linus Pauling,France,Canvas Tote,4,96.00
A-1081,2026-10-11,Nikola Tesla,Germany,Wool Socks (3 pack),1,30.00
`;

/**
 * Three exports of the same kind of data from three shops, as they really
 * arrive: different column order, a semicolon file with decimal commas, a
 * missing email column, an extra coupon column and "Email " with a space.
 */
export const MERGE_SAMPLES = [
  { name: "shop-paris.csv", text: `order_id,date,customer,email,total
P-201,2026-10-01,Ada Lovelace,ada@example.com,59.00
P-202,2026-10-02,Grace Hopper,grace@example.org,24.00
P-203,2026-10-04,Alan Turing,alan@example.net,119.00
` },
  { name: "shop-lyon.csv", text: `Order_ID;Date;Customer;Total;Coupon
L-77;2026-10-03;Marie Curie;44,00;AUTUMN10
L-78;2026-10-05;"Hopper; Grace";30,00;
` },
  { name: "web-orders.csv", text: `order_id,date,customer,Email ,total,channel
W-9001,2026-10-06,Katherine Johnson,katherine@example.com,88.50,web
W-9002,2026-10-06,Hedy Lamarr,hedy@example.com,29.50,app
` },
];
